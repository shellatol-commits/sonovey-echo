const BASE_ID = "appbrRoPiqiN2GUva";
const TABLE_ID = "tblQO2Ee70tX0izBw";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "*";
    const headers = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
      "Content-Type": "application/json; charset=utf-8"
    };

    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (url.pathname !== "/catalog") {
      return Response.json({ error: "Not found" }, { status: 404, headers });
    }

    if (request.method !== "GET") {
      return Response.json(
        { error: "Method not allowed" },
        { status: 405, headers }
      );
    }

    if (!env.AIRTABLE_TOKEN) {
      return Response.json(
        { error: "Cloudflare Worker secret AIRTABLE_TOKEN is missing" },
        { status: 503, headers }
      );
    }

    const airtableUrl = new URL(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`
    );

    airtableUrl.searchParams.set("pageSize", "100");
    airtableUrl.searchParams.set("sort[0][field]", "Title");
    airtableUrl.searchParams.set("sort[0][direction]", "asc");
    airtableUrl.searchParams.set("filterByFormula", "{Published}=1");

    try {
      const records = [];
      let offset;

      do {
        if (offset) airtableUrl.searchParams.set("offset", offset);

        const response = await fetch(airtableUrl, {
          headers: {
            Authorization: `Bearer ${env.AIRTABLE_TOKEN}`
          }
        });

        const data = await response.json();

        if (!response.ok) {
          console.error("Airtable error:", response.status);
          return Response.json(
            { error: "Airtable request failed. Check token permissions and field names." },
            { status: 502, headers }
          );
        }

        records.push(...(data.records || []));
        offset = data.offset;
      } while (offset && records.length < 500);

      return Response.json({ records }, { headers });
    } catch (error) {
      console.error("Catalog request failed:", error);
      return Response.json(
        { error: "Unable to load catalog" },
        { status: 500, headers }
      );
    }
  }
};
