import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(here, "../postman/Rokdim3000.postman_collection.json");

const variables = [
  ["baseUrl", "http://localhost:3000"],
  ["userEmail", "user@example.com"],
  ["userPassword", "change-me"],
  ["userPhone", "050-1234567"],
  ["userToken", ""],
  ["adminEmail", "yben99@gmail.com"],
  ["adminPassword", "change-me"],
  ["adminToken", ""],
  ["instructorUsername", "instructor_demo"],
  ["instructorPassword", "change-me"],
  ["instructorToken", ""],
  ["danceId", "1"],
  ["contactId", "1"],
  ["fileId", "1"],
  ["resetToken", "paste-reset-token-here"],
  ["imageFilePath", "/absolute/path/to/profile.jpg"],
  ["instructorFilePath", "/absolute/path/to/dance-list.pdf"],
];

const tokenTest = (variable) => [{
  listen: "test",
  script: {
    type: "text/javascript",
    exec: [
      "if (pm.response.code >= 200 && pm.response.code < 300) {",
      "  const data = pm.response.json();",
      `  if (data.token) pm.collectionVariables.set(${JSON.stringify(variable)}, data.token);`,
      "}",
    ],
  },
}];

function request(name, method, route, { auth, json, form, query, description, events } = {}) {
  const headers = [];
  if (auth) headers.push({ key: "Authorization", value: `Bearer {{${auth}}}`, type: "text" });
  const url = { raw: `{{baseUrl}}${route}`, host: ["{{baseUrl}}"], path: route.replace(/^\//, "").split("/") };
  if (query) url.query = query.map(([key, value, disabled = false]) => ({ key, value, disabled }));
  const req = { method, header: headers, url, description };
  if (json !== undefined) {
    headers.push({ key: "Content-Type", value: "application/json", type: "text" });
    req.body = { mode: "raw", raw: JSON.stringify(json, null, 2), options: { raw: { language: "json" } } };
  }
  if (form) req.body = { mode: "formdata", formdata: form };
  return { name, event: events, request: req, response: [] };
}

const collection = {
  info: {
    _postman_id: "fe09f634-f317-4a17-a070-300000000001",
    name: "Rokdim 3000 API",
    description: "Complete collection generated from server/src/routes. Login requests automatically save JWTs as collection variables. Run the relevant login before protected requests. Dance create/update/delete use userToken from a normal user whose email equals ADMIN_EMAIL; other admin endpoints use adminToken from Admin Login.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  variable: variables.map(([key, value]) => ({ key, value, type: "string" })),
  item: [
    { name: "System", item: [
      request("Health", "GET", "/api/health", { description: "Server health check." }),
    ]},
    { name: "Authentication", item: [
      request("Register", "POST", "/api/auth/register", { json: { email: "{{userEmail}}", password: "{{userPassword}}", phone: "{{userPhone}}" }, events: tokenTest("userToken"), description: "Creates a user and saves the returned JWT to userToken." }),
      request("Login", "POST", "/api/auth/login", { json: { email: "{{userEmail}}", password: "{{userPassword}}" }, events: tokenTest("userToken"), description: "Saves the returned JWT to userToken." }),
      request("Forgot Password", "POST", "/api/auth/forgot-password", { json: { email: "{{userEmail}}" }, description: "In local development without SMTP, the response includes resetLink." }),
      request("Reset Password", "POST", "/api/auth/reset-password", { json: { token: "{{resetToken}}", newPassword: "{{userPassword}}" } }),
    ]},
    { name: "Users", item: [
      request("Get My Profile", "GET", "/api/users/me", { auth: "userToken" }),
      request("Update My Profile", "PUT", "/api/users/me", { auth: "userToken", json: { phone: "{{userPhone}}", freeText: "I enjoy circle and couple dances." } }),
      request("Upload Profile Image", "POST", "/api/upload/image", { auth: "userToken", form: [{ key: "image", type: "file", src: "{{imageFilePath}}" }], description: "Select a JPEG, PNG, GIF, or WebP file (maximum 5 MB) in Postman if the path variable is not resolved." }),
    ]},
    { name: "Dances", item: [
      request("List Dances", "GET", "/api/dances"),
      request("Create Dance (dance admin user)", "POST", "/api/dances", { auth: "userToken", json: { name: "ריקוד לדוגמה", type: "circle", creator: "יוצר לדוגמה", yearOfCreation: 2026, category: "ישראלי", difficultyLevel: "beginner", youtubeLink: "https://www.youtube.com/watch?v=example" }, description: "Requires a normal user JWT whose email equals server ADMIN_EMAIL (not adminToken)." }),
      request("Update Dance (dance admin user)", "PUT", "/api/dances/{{danceId}}", { auth: "userToken", json: { name: "ריקוד מעודכן", difficultyLevel: "intermediate" }, description: "Requires a normal user JWT whose email equals server ADMIN_EMAIL." }),
      request("Delete Dance (dance admin user)", "DELETE", "/api/dances/{{danceId}}", { auth: "userToken", description: "Destructive. Requires a normal user JWT whose email equals server ADMIN_EMAIL." }),
    ]},
    { name: "Dance Opinions", item: [
      request("Get My Dance Opinion", "GET", "/api/dance-opinions", { auth: "userToken" }),
      request("Save My Dance Opinion", "PUT", "/api/dance-opinions", { auth: "userToken", json: { opinionText: "My thoughts about the dance program." } }),
    ]},
    { name: "User Dance Ratings", item: [
      request("Get All My Ratings", "GET", "/api/dance-ratings", { auth: "userToken" }),
      request("Get My Rating for Dance", "GET", "/api/dance-ratings/{{danceId}}", { auth: "userToken" }),
      request("Set My Rating for Dance", "PUT", "/api/dance-ratings/{{danceId}}", { auth: "userToken", json: { knowledge: 4, enjoyment: 5 } }),
    ]},
    { name: "Admin", item: [
      request("Admin Login", "POST", "/api/admin/login", { json: { email: "{{adminEmail}}", password: "{{adminPassword}}" }, events: tokenTest("adminToken"), description: "Saves the returned JWT to adminToken." }),
      request("Create Instructor Account", "POST", "/api/admin/instructors", { auth: "adminToken", json: { username: "{{instructorUsername}}" }, description: "The generated password is returned only once; copy it into instructorPassword." }),
      request("Reset Instructor Password", "POST", "/api/admin/instructors/{{instructorUsername}}/reset-password", { auth: "adminToken", description: "Invalidates the old password and returns a newly generated password." }),
      request("List Instructor Contacts", "GET", "/api/admin/instructor-contacts", { auth: "adminToken", query: [["q", "", true], ["limit", "200"]] }),
      request("Get Instructor Contact", "GET", "/api/admin/instructor-contacts/{{contactId}}", { auth: "adminToken" }),
      request("Create Instructor Contact", "POST", "/api/admin/instructor-contacts", { auth: "adminToken", json: { fullName: "ישראל ישראלי", phone: "050-1234567", status: "active", source: "Public listing", notes: "Example contact" } }),
      request("Bulk Create Instructor Contacts", "POST", "/api/admin/instructor-contacts/bulk", { auth: "adminToken", json: { contacts: [{ fullName: "ישראל ישראלי", phone: "050-1234567", status: "active", source: "Public listing", notes: "First example" }, { fullName: "ישראלה ישראלי", phone: "052-7654321", status: "course_graduate", source: "Course list", notes: "Second example" }] } }),
    ]},
    { name: "Instructors - Admin View", item: [
      request("List Instructors", "GET", "/api/instructors", { auth: "adminToken" }),
      request("List Instructor Uploads", "GET", "/api/instructors/uploads", { auth: "adminToken" }),
      request("Get Instructor Details", "GET", "/api/instructors/{{instructorUsername}}", { auth: "adminToken" }),
      request("Delete Instructor File", "DELETE", "/api/instructors/{{instructorUsername}}/files/{{fileId}}", { auth: "adminToken", description: "Destructive: deletes both the database record and uploaded file." }),
    ]},
    { name: "Instructors - Self Service", item: [
      request("Instructor Login", "POST", "/api/instructors/login", { json: { username: "{{instructorUsername}}", password: "{{instructorPassword}}" }, events: tokenTest("instructorToken"), description: "Saves the returned JWT to instructorToken." }),
      request("Get My Submission", "GET", "/api/instructors/submission", { auth: "instructorToken" }),
      request("Save My Submission", "PUT", "/api/instructors/submission", { auth: "instructorToken", json: { circleDances: "ריקוד מעגל 1\nריקוד מעגל 2", coupleDances: "ריקוד זוגות 1", notes: "Example notes" } }),
      request("List My Files", "GET", "/api/instructors/files", { auth: "instructorToken" }),
      request("Upload My File", "POST", "/api/instructors/files", { auth: "instructorToken", form: [{ key: "file", type: "file", src: "{{instructorFilePath}}" }], description: "Select a file (maximum 15 MB) in Postman if the path variable is not resolved." }),
      request("Get My Dance Rating", "GET", "/api/instructors/ratings/{{danceId}}", { auth: "instructorToken" }),
      request("Set My Dance Rating", "PUT", "/api/instructors/ratings/{{danceId}}", { auth: "instructorToken", json: { knowledge: 4, enjoyment: 5 } }),
    ]},
  ],
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(collection, null, 2)}\n`);
console.log(`Generated ${output}`);
