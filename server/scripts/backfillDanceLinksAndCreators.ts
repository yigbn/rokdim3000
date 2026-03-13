import { getDb, initDb, migrateDancesTable } from "../src/db/schema.js";

type SourceDance = {
  id: number;
  name: string;
  creator: string;
  link: string;
};

const HAROKDIM_LIST_URL = "http://www.harokdim.org/dances/view_list.php";
const HAROKDIM_VIDEO_URL_PREFIX = "http://www.harokdim.org/dances/playvideo.php?id=";
const HAROKDIM_MUSIC_URL_PREFIX = "http://www.harokdim.org/dances/playmusic.php?id=";

const EXTRA_SOURCES: Array<{ name: string; creator?: string; link: string }> = [
  {
    name: "חג המשק",
    creator: "אבי לוי",
    link: "https://www.israelidances.com/dance_details.asp?DanceID=11692",
  },
  {
    name: "עוף מוזר",
    creator: "דודו ברזילי + ירון מליחי",
    link: "https://www.israelidances.com/dance_details.asp?DanceID=11653",
  },
  {
    name: "פלונטר",
    creator: "סאגי אזראן",
    link: "https://israelidances.com/dance_details.asp?DanceID=5219",
  },
];

function decodeHtml(input: string): string {
  return input
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ");
}

function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[״"]/g, "\"")
    .replace(/[׳']/g, "'")
    .toLowerCase();
}

function removeParenthetical(name: string): string {
  return name.replace(/\s*\([^)]*\)/g, "").trim();
}

function buildYoutubeSearchLink(name: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} ריקוד עם`)}`;
}

async function fetchSourceDances(): Promise<SourceDance[]> {
  const res = await fetch(HAROKDIM_LIST_URL);
  if (!res.ok) {
    throw new Error(`Failed fetching source list: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();

  const results: SourceDance[] = [];
  const rows = html.split("<tr>");
  for (const row of rows) {
    const idMatch = row.match(/#(\d+)<\/font>/);
    if (!idMatch) continue;

    const titleCells = [...row.matchAll(/<td><font size=3>([^<]+?)\s*<\/font><\/td>/g)];
    if (titleCells.length < 2) continue;

    const id = Number.parseInt(idMatch[1], 10);
    const name = decodeHtml(titleCells[0][1]).trim();
    const creator = decodeHtml(titleCells[1][1]).trim();
    const videoMatch = row.match(/newvideowindow\('playvideo\.php\?id=(\d+)'\)/);
    const musicMatch = row.match(/newplaywindow\('playmusic\.php\?id=(\d+)'\)/);

    let link = "";
    if (videoMatch) {
      link = `${HAROKDIM_VIDEO_URL_PREFIX}${videoMatch[1]}`;
    } else if (musicMatch) {
      link = `${HAROKDIM_MUSIC_URL_PREFIX}${musicMatch[1]}`;
    }

    if (!Number.isNaN(id) && name) {
      results.push({ id, name, creator, link });
    }
  }

  if (results.length < 380) {
    throw new Error(`Parsed too few source dances (${results.length}).`);
  }

  return results;
}

async function main(): Promise<void> {
  const sourceDances = await fetchSourceDances();
  for (const extra of EXTRA_SOURCES) {
    sourceDances.push({
      id: -1,
      name: extra.name,
      creator: extra.creator ?? "",
      link: extra.link,
    });
  }

  const byExactName = new Map<string, SourceDance>();
  const byNoParensName = new Map<string, SourceDance[]>();
  for (const d of sourceDances) {
    byExactName.set(normalizeName(d.name), d);
    const noParens = normalizeName(removeParenthetical(d.name));
    const bucket = byNoParensName.get(noParens) ?? [];
    bucket.push(d);
    byNoParensName.set(noParens, bucket);
  }

  const db = getDb();
  initDb(db);
  migrateDancesTable(db);

  const rows = db
    .prepare("SELECT id, name, creator, youtube_link FROM dances")
    .all() as Array<{ id: number; name: string; creator: string | null; youtube_link: string | null }>;

  const update = db.prepare(`
    UPDATE dances
    SET creator = COALESCE(?, creator),
        youtube_link = COALESCE(?, youtube_link)
    WHERE id = ?
  `);

  let updatedRows = 0;
  let creatorFilled = 0;
  let linkFilled = 0;
  let unmatchedMissing = 0;

  const tx = db.transaction(() => {
    for (const row of rows) {
      const hasMissingCreator = !row.creator || row.creator.trim() === "";
      const hasMissingLink = !row.youtube_link || row.youtube_link.trim() === "";
      if (!hasMissingCreator && !hasMissingLink) continue;

      const key = normalizeName(row.name);
      let source = byExactName.get(key);

      if (!source) {
        const fallbackKey = normalizeName(removeParenthetical(row.name));
        const options = byNoParensName.get(fallbackKey) ?? [];
        if (options.length === 1) source = options[0];
      }

      if (!source) {
        const nextLink = hasMissingLink ? buildYoutubeSearchLink(row.name) : null;
        if (nextLink) {
          update.run(null, nextLink, row.id);
          updatedRows++;
          linkFilled++;
        } else {
          unmatchedMissing++;
        }
        continue;
      }

      const nextCreator = hasMissingCreator && source.creator ? source.creator : null;
      const nextLink = hasMissingLink && source.link ? source.link : null;

      if (!nextCreator && !nextLink) continue;

      update.run(nextCreator, nextLink, row.id);
      updatedRows++;
      if (nextCreator) creatorFilled++;
      if (nextLink) linkFilled++;
    }
  });

  tx();
  db.close();

  console.log(
    [
      `Source rows parsed: ${sourceDances.length}`,
      `DB rows scanned: ${rows.length}`,
      `Rows updated: ${updatedRows}`,
      `creator filled: ${creatorFilled}`,
      `youtube_link filled: ${linkFilled}`,
      `unmatched rows with missing fields: ${unmatchedMissing}`,
    ].join("\n")
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
