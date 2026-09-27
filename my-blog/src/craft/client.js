/**
 * Minimal read-only client for the Craft API.
 * See https://connect.craft.do/api-docs/space
 */
export function createCraftClient({ apiUrl, apiKey }) {
  if (!apiUrl) {
    throw new Error(
      "CRAFT_API_URL is not set. Create an API connection in Craft's Imagine tab and export its URL."
    )
  }
  const base = apiUrl.replace(/\/+$/, "")

  async function get(path, params) {
    const url = new URL(`${base}${path}`)
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }

    const headers = { Accept: "application/json" }
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`

    const res = await fetch(url, { headers })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      // The connection URL embeds its secret, so report only the path.
      throw new Error(`Craft API ${path} failed: ${res.status} ${res.statusText} ${body}`.trim())
    }
    return res.json()
  }

  return {
    /** Documents in a folder (and its subfolders), with created/modified dates. */
    async listDocuments(folderId) {
      const { items } = await get("/documents", { folderId, fetchMetadata: true })
      return items
    },

    /** A document's root page block with all of its descendants. */
    async getDocumentBlocks(documentId) {
      return get("/blocks", { id: documentId, maxDepth: -1 })
    },
  }
}
