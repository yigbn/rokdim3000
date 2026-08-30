# Rokdim 3000 Postman collection

Import `Rokdim3000.postman_collection.json` into Postman. The collection contains every endpoint currently registered by the server and includes collection-level variables, so no separate environment import is required.

Before using it:

1. Start the server (`npm run dev:server` from the repository root).
2. In the collection's **Variables** tab, set passwords and test identities as needed. The default `baseUrl` is `http://localhost:3000`.
3. Run **Authentication / Login**, **Admin / Admin Login**, or **Instructors - Self Service / Instructor Login** before the corresponding protected requests. Each login automatically stores its JWT in the appropriate collection variable.

Important: dance create/update/delete use `userToken` from an ordinary account whose email matches the server's `ADMIN_EMAIL`. The instructor-management endpoints use the separate `adminToken` returned by **Admin Login**.

File requests may require choosing the file manually in Postman's Body tab, depending on Postman's local-file permissions.

To regenerate the collection after routes change:

```bash
node server/scripts/generatePostmanCollection.mjs
```
