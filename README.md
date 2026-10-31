# Site Inventory

1. Push this folder to a new GitHub repository.
2. On vercel.com: Add New > Project > import the repository.
3. In the project: Storage > Create > Upstash Redis (free). Connect it to the project; this adds the database keys.
4. Settings > Environment Variables: add OWNER_PASSWORD, SUPERVISOR_PASSWORD and SESSION_SECRET (any long random text).
5. Redeploy. Open the link, sign in as Owner, then add your sites and materials under Setup.

Rules built in: nothing is edited or deleted; only the owner can void (with a reason); transfers and usage cannot exceed a site's balance.
Transfers and usage leave a site at that site's average cost for the material. Export Excel gives a Balances sheet and an All entries sheet.
