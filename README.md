# whitney-mcp-ts

An MCP server for the Whitney Museum's public API. Search the collection, artists, exhibitions, events and audio guides from Claude Desktop or any MCP client.

TypeScript, stdio only, friendly parameters mapped onto the API's Ransack syntax, and responses trimmed to keep them manageable in a model's context.

No API key needed. The Whitney's API is open and unauthenticated.

Not affiliated with the Whitney Museum of American Art. This is a third-party wrapper around their public API, documented at <https://whitney.org/about/website/api>.

See also Sam Parsons' [whitney-museum-mcp](https://github.com/sam-parsons/whitney-museum-mcp) — a Python/FastMCP server over the same API, with Docker and HTTP transport. 


## Install

```bash
npx whitney-mcp-ts
```

Or from source:

```bash
git clone https://github.com/mildlydiverting/whitney-mcp-ts.git
cd whitney-mcp-ts
npm install
npm run build
```

Node 20 or newer.

## Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "whitney": {
      "command": "npx",
      "args": ["-y", "whitney-mcp-ts"]
    }
  }
}
```

From source, point at the build instead:

```json
{
  "mcpServers": {
    "whitney": {
      "command": "node",
      "args": ["/absolute/path/to/whitney-mcp-ts/dist/index.js"]
    }
  }
}
```

Quit and reopen Claude Desktop. The config doesn't expand `~`, so use a full path.

## Tools

| Tool | What it does |
| --- | --- |
| `whitney_search_artworks` | Search 27,000+ works by title, artist, classification, medium, date, on-view status |
| `whitney_get_artwork` | Full record for one work — dimensions, credit line, description, image URLs |
| `whitney_search_artists` | Search 7,000+ artists; filter by collection, Biennial, on view |
| `whitney_get_artist` | Full artist record, including biography, Getty ULAN and Wikidata IDs |
| `whitney_artist_artworks` | Works by a given artist |
| `whitney_artist_exhibitions` | Exhibitions featuring a given artist |
| `whitney_search_exhibitions` | Exhibitions from 1931 onwards, with date filtering |
| `whitney_get_exhibition` | One exhibition record |
| `whitney_search_events` | Talks, tours and programmes from 2008 onwards |
| `whitney_search_guides` | Audio guides published since 2009 |
| `whitney_query` | Any endpoint, with raw Ransack predicates |

## What to expect

**Search returns slim records.** Whitney records carry long HTML descriptions and biographies, so search gives you the basics and `whitney_get_*` gives you everything. Prose is truncated at 2,000 characters, whole responses at 25,000.

**Pagination is 30 per page.** That's the API's page size. `page` picks the page, `limit` trims it further — the default of 10 stops a broad search flooding your context.

**Search syntax is Ransack.** Predicates nest under `q` (`_eq`, `_cont`, `_cont_all_split`, `_gteq` and friends), sorting under `q[s]`. The typed tools map friendly arguments onto these. `whitney_query` exposes them raw, for anything the typed tools don't reach.

**Artist and artwork fields are mapped explicitly.** Exhibitions, events, guides and pages go through a generic summariser instead: HTML stripped, timestamps shortened to dates, relative URLs made absolute, internal foreign keys dropped. The Museum says its field set may change, so nothing is hard-coded that doesn't need to be. Run a search with `limit: 1` to see the real field names, then use `filters` for anything specific.

## Known API quirks

- `sort: "random"` doesn't reliably randomise. Asking for three random works returned three consecutive accession numbers by the same artist. If you need genuine randomness, request a random page number instead.
- `display_date` on artworks is free text — "1915–1931, printed 1976–1977" — so date ranges don't work there. Exhibitions and events have real timestamps, and `starts_on_or_after` / `starts_on_or_before` filter on those.
- Living artists have `death_year: "0"`. Don't do arithmetic on it.
- Ransack ignores predicates it doesn't recognise rather than erroring, so a misspelled field silently returns everything. Check your result counts.

## Bulk data

For anything at scale, don't page through the API. The Whitney publishes artist and artwork CSVs at <https://github.com/whitneymuseum/open-access>, released under CC0.

## Licences

Code under MIT `LICENSE`.

The Whitney owns the data returned.

The Whitney states that material accessed through the API may be protected by copyright and other restrictions, and permits noncommercial educational and personal use, plus fair use, provided copyright notices are retained and the author and source cited. Read their terms at <https://whitney.org/about/website/api> before you build anything public on it.

Note the CSV datasets linked above are CC0, which is more permissive than the API terms. Same data, different door.

## Thanks

To the Whitney's digital team for publishing an API at all, and for documenting it properly.
