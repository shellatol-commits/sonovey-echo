// Sonovey Echo public read-only catalog endpoint for Vercel.
// Airtable credentials are server-side environment variables only.
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID || "appbrRoPiqiN2GUva";
  // Airtable accepts a table ID or table name. Table ID avoids rename issues.
  const table = process.env.AIRTABLE_MEDIA_TABLE || "tblQO2Ee70tX0izBw";

  if (!token) {
    return res.status(200).json({
      configured: false,
      records: [],
      message: "Set AIRTABLE_TOKEN in Vercel Environment Variables."
    });
  }

  try {
    const url = new URL(
      `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}`
    );
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("sort[0][field]", process.env.AIRTABLE_SORT_FIELD || "Title");
    url.searchParams.set("sort[0][direction]", "asc");
    // Only show records whose Published checkbox is checked.
    url.searchParams.set("filterByFormula", "{Published}=1");

    const records = [];
    let offset;
    do {
      if (offset) url.searchParams.set("offset", offset);
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const body = await response.json();

      if (!response.ok) {
        console.error("Airtable catalog request failed:", response.status, body?.error?.type || "");
        return res.status(502).json({
          error: "Airtable request failed. Check the token permissions, base ID, table ID, and field names."
        });
      }

      records.push(...(body.records || []));
      offset = body.offset;
    } while (offset && records.length < 500);

    return res.status(200).json({ configured: true, records });
  } catch (error) {
    console.error("Sonovey Echo catalog error:", error);
    return res.status(500).json({ error: "Unable to load catalog." });
  }
};
