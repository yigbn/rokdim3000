import nodemailer from "nodemailer";

const transporter =
  process.env.SMTP_HOST && process.env.SMTP_USER
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true",
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASS
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
      })
    : null;

const from = process.env.MAIL_FROM || "רוקדים 300 <noreply@rokdim300.co.il>";

export async function sendResetPasswordEmail(to: string, resetLink: string): Promise<boolean> {
  if (!transporter) return false;
  try {
    await transporter.sendMail({
      from,
      to,
      subject: "איפוס סיסמה — רוקדים 300",
      text: `שלום,\n\nביקשת לאפס את הסיסמה בחשבון רוקדים 300.\n\nלחץ על הקישור הבא (תקף לשעה):\n${resetLink}\n\nאם לא ביקשת איפוס, התעלם ממייל זה.\n\nרוקדים 300`,
      html: `
        <p>שלום,</p>
        <p>ביקשת לאפס את הסיסמה בחשבון רוקדים 300.</p>
        <p><a href="${resetLink}">לחץ כאן לאיפוס הסיסמה</a> (הקישור תקף לשעה).</p>
        <p>אם לא ביקשת איפוס, התעלם ממייל זה.</p>
        <p>רוקדים 300</p>
      `,
    });
    return true;
  } catch {
    return false;
  }
}

export function isEmailConfigured(): boolean {
  return !!transporter;
}
