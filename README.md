# whitney-mcp-server

An MCP server over the [Whitney Museum of American Art public API](https://whitney.org/about/website/api) — artists, artworks, exhibitions, events and audio guides. No API key, no account, no auth.

## Install

```bash
cd whitney-mcp-server
npm install
npm run build
```

Node 20 or newer (the server uses the built-in `fetch`).

If `npm install` complains about peer versions, check the current releases of `@modelcontextprotocol/sdk` and `zod` and update `package.json` — the pins here are conservative rather than verified against today's registry.

## Test before wiring it up

```bash
npm run inspect
```

That opens the MCP Inspector against the built server. Try `whitney_search_artworks` with `title: "moon"` and `classification: "Paintings"` — you should get a handful of works back. Then try `whitney_get_artist` with `id: "962"` (Georgia O'Keeffe).

## Add to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "whitney": {
      "command": "node",
      "args": ["/absolute/path/to/whitney-mcp-server/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop. Use an absolute path — the config does not expand `~`.

## Tools

| Tool | What it does |
| --- | --- |
| `whitney_search_artworks` | Search 27,000+ works by title, artist, classification, medium, date, on-view status |
| `whitney_get_artwork` | Full record for one work, including dimensions, credit line and image URLs |
| `whitney_search_artists` | Search 7,000+ artists; filter by collection, Biennial, on view |
| `whitney_get_artist` | Full artist record including biography, Getty ULAN and Wikidata IDs |
| `whitney_artist_artworks` | Works by a given artist |
| `whitney_artist_exhibitions` | Exhibitions featuring a given artist |
| `whitney_search_exhibitions` / `whitney_get_exhibition` | Exhibitions from 1931 onwards |
| `whitney_search_events` | Talks, tours and programmes from 2008 onwards |
| `whitney_search_guides` | Audio guides published since 2009 |
| `whitney_query` | Raw endpoint access with arbitrary Ransack predicates |

## Design notes

**Context, not completeness.** Whitney records carry long HTML descriptions, biographies and multi-line dimension strings. Search tools return slim summaries; detail tools return the full record with HTML stripped and prose truncated at 2,000 characters. Responses are capped at 25,000 characters overall.

**Pagination.** The API returns a fixed 30 records per page. `page` selects the page; `limit` trims client-side, defaulting to 10 so that a broad search does not flood the context.

**Search syntax.** The API uses Ransack-style predicates nested under `q` (`_eq`, `_cont`, `_cont_all_split`, `_gt`, `_true` and so on), with sorting under `q[s]`. The typed tools map friendly arguments onto these; `whitney_query` exposes them directly.

**Field coverage.** Artwork and artist fields are mapped explicitly, since those responses were inspected directly. Exhibition, event, guide and page fields are passed through a generic summariser instead — the Museum states the field set is subject to change, and guessing field names would produce silent empty filters. Run a search with `limit: 1` to see the real field names, then use `filters` for anything specific.

**Unverified.** No rate limit is documented. The Museum asks that use be respectful so the API stays performant for everyone; for bulk work, use the [open access CSVs](https://github.com/whitneymuseum/open-access) instead of paginating the API.

## Licence and use

The MCP server code is MIT. The *data* is not: the Whitney states that material accessed through the API may be protected by copyright and other restrictions, and permits noncommercial educational and personal use, plus fair use, provided copyright notices are retained and the author and source are cited.
