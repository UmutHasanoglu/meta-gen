# Stock Image Metadata Generator

Generate fast, consistent **titles, descriptions, and keywords** for stock assets.
Bulk upload images, pick an AI model (OpenAI or Gemini), edit inline, drag‑reorder keywords, and export **CSV** for Adobe Stock, Shutterstock, Vecteezy, Freepik, and Dreamstime.

---

## ✨ Features

* **Bulk generate** from multiple images (drag & drop or select files)
* **Model providers**: OpenAI (`gpt-4o`, `gpt-4o-mini`, `gpt-4.1`) and Google Gemini (`gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`)
* **Controls**: file type, title length (chars), description length (words), exact keyword count
* **Inline editing** with one‑click **Copy** for title/description/keywords
* **Keywords**:

  * Drag-to-reorder chips
  * Remove chip with ×
  * Add keyword via a small input + **➕**
  * **Tidy** (trim, dedupe case-insensitively, truncate to exact count)
* **Per-item Regenerate** with current settings
* **History** with thumbnails, pagination (100/page), selection & **export selected**
* **CSV export** presets:

  * **Adobe Stock**: `Filename, Title, Keywords, Category, Releases` (last two blank by default)
  * \*\*Shutterstock, Vecteezy, Freepik, Dreamstime\`
* **Performance**:

  * Client-side image resize to **max 1024px** (keeps aspect ratio)
  * **Instruction prompt caching** (hash) to avoid resending the same long prompt each image
* **Dark, high-contrast UI** (neutral blacks/greys + purple accent)

---

## 🚀 Quick start

### Prerequisites

* Node.js **18+** (18.17+ recommended) or **20+**
* pnpm (via Corepack) or npm

### Install & run (local)

```bash
# enable pnpm if needed
corepack enable

# install deps
pnpm install

# dev server
pnpm dev
# → http://localhost:3000
```

> If you see “Found multiple lockfiles”, delete the one you aren’t using (e.g. remove `package-lock.json` if using pnpm).

### Deploy (Vercel)

1. Push the repo to GitHub.
2. Import the repo in Vercel.
3. Build command: `pnpm build`
4. Output: Next.js defaults (no `vercel.json` required).

---

## 🧑‍💻 Using the app

1. **Provider & Model**
   Choose OpenAI or Gemini, pick a model, paste your **API key**, and click **Save**.
   Keys are stored **locally in your browser** (not on a server).

2. **Settings**
   Set file type (photo / illustration / vector / icon / transparent PNG), target title chars, description word count, and **keywords count**. Add **Extra instructions** if needed.

3. **Upload**
   Drag & drop images or click **Select images**. (Previews are hidden until generation completes.)

4. **Generate**
   Click **Generate metadata**. A progress bar shows batch status.

5. **Polish**

   * Edit Title/Description inline and **Save**.
   * **Keywords**:

     * Drag chips to reorder, **×** to remove
     * Add with the small input + **➕**
     * Click **Tidy** to clean + enforce exact count
   * **Copy** any field in one click
   * **Regenerate** an item with current settings

6. **Export CSV**
   In **Results** or **History**, export the **page** or **selected items** for your target marketplace.

---

## 🗂 CSV formats

### Adobe Stock (official header)

Header and example row (Category & Releases blank by design):

```
Filename,Title,Keywords,Category,Releases
image_filename.jpg,A short description of what the asset represents,"Keyword1, Keyword2, Keyword3",,
```

Other marketplaces map to their common fields (filename/title/description/keywords).
CSVs use **CRLF** line endings with all fields quoted.

---

## 🧠 How it works

* **Client-side resize**: images are scaled down to max 1024px on the longer side before upload — faster and cheaper.
* **System prompt**: robust defaults tuned for stock marketplaces; add per-batch **extra instructions**.
* **Prompt caching**: we hash the instruction text and send the hash to the API route so providers can reuse cached prompts within a batch (when supported).
* **Local history**: items (including edits/errors) are saved in IndexedDB; thumbnails are base64 data URLs.
* **Privacy**: images are posted only to your project’s serverless API routes for generation; API keys are **not** stored on the server.

---

## ⚙️ Configuration

No env vars are required for local use — supply API keys in the UI.

**Models shown in the UI**

* **OpenAI**: `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`
* **Gemini**: `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`

> Want more models? Edit the arrays near the top of `app/page.tsx`.

---

## 🧰 Tech stack

* **Next.js 15 (App Router)**, React 19
* Tailwind CSS 4 + shadcn/ui + Radix Primitives
* IndexedDB via **idb-keyval**, **nanoid**, **lucide-react**
* Serverless API routes for **OpenAI** and **Gemini**

---

## 🧪 Scripts

```bash
pnpm dev       # start dev server
pnpm build     # production build
pnpm start     # run production build locally
pnpm lint      # lint & typecheck
```

---

## 🐞 Troubleshooting

* **Multiple lockfiles warning**
  Keep only one: remove either `pnpm-lock.yaml` or `package-lock.json`.

* **API errors (400/401/429)**
  Double-check your key, model name, and quota. Per-item errors appear on the card.

* **CSV didn’t download**
  Downloads are user-initiated clicks; if blocked, try another browser.

---

## 🗺 Roadmap

* Optional Adobe **Category** and **Releases** inputs per item
* Reorderable keyword chips in History view
* Team sync (Supabase) and role-based access
* Landing page + public demo mode

---

## 📄 License

MIT — see `LICENSE`.

---

## 🙏 Acknowledgements

UI components by **shadcn/ui** & **Radix**. Icons by **lucide-react**.
Thanks to OpenAI & Google for model APIs.
