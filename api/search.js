import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";

export default async function handler(req, res) {
  const q = (req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "Missing q" });

  try {
    const [wikiData, imagesData, newsData, pdfData, audioData, webData] =
      await Promise.all([
        wiki(q),
        images(q),
        news(q),
        pdfs(q),
        audio(q),
        web(q)
      ]);

    res.setHeader("Access-Control-Allow-Origin", "*");
    
    return res.status(200).json({
      query: q,
      wiki: wikiData,
      images: imagesData,
      news: newsData,
      pdfs: pdfData,
      audio: audioData,
      web: webData
    });

  } catch (err) {
    console.error("Search API Error:", err);
    res.status(500).json({ error: "Internal Proxy Error", detail: err.message });
  }
}


/* ──────────────────────────────────────────────── */
/*                    WIKIPEDIA                     */
/* ──────────────────────────────────────────────── */

async function wiki(q) {
  try {
    const url = `https://es.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(q)}&redirects=1`;
    const r = await fetch(url);
    const j = await r.json();

    const page = Object.values(j.query.pages)[0];
    if (page.missing) return null;

    return {
      title: page.title,
      extract: page.extract,
      url: `https://es.wikipedia.org/?curid=${page.pageid}`
    };
  } catch {
    return null;
  }
}


/* ──────────────────────────────────────────────── */
/*     IMÁGENES (con token vqd — FUNCIONA 2025)    */
/* ──────────────────────────────────────────────── */

async function images(q) {
  try {
    // 1) Sacar token vqd
    const home = await fetch("https://duckduckgo.com/?q=" + encodeURIComponent(q), {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const homeHTML = await home.text();
    const vqdMatch = homeHTML.match(/vqd=([\d-]+)/);

    if (!vqdMatch) {
      console.warn("No se encontró vqd");
      return [];
    }

    const vqd = vqdMatch[1];

    // 2) Buscar imágenes con token vqd
    const url = `https://duckduckgo.com/i.js?o=json&q=${encodeURIComponent(q)}&vqd=${vqd}`;
    
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const j = await r.json();

    return j.results?.map(i => ({
      image: i.image,
      thumbnail: i.thumbnail,
      title: i.title,
      source: i.url
    })) || [];

  } catch (error) {
    console.error("Error en imágenes:", error);
    return [];
  }
}


/* ──────────────────────────────────────────────── */
/*                      NOTICIAS                    */
/* ──────────────────────────────────────────────── */

async function news(q) {
  try {
    const rss = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=es-419&gl=MX&ceid=MX:es-419`;
    const r = await fetch(rss);
    const xml = await r.text();

    const parsed = await parseStringPromise(xml);

    return parsed.rss.channel[0].item.map(x => ({
      title: x.title[0],
      link: x.link[0],
      date: x.pubDate[0],
      source: x.source?.[0]?._ || ""
    }));
  } catch {
    return [];
  }
}


/* ──────────────────────────────────────────────── */
/*                       PDFS                       */
/* ──────────────────────────────────────────────── */

async function pdfs(q) {
  try {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent("filetype:pdf " + q)}`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await r.text();

    const pdfs = [...html.matchAll(/https?:\/\/[^"']+?\.pdf/g)].map(m => m[0]);
    return [...new Set(pdfs)].slice(0, 20).map(url => ({ url }));

  } catch {
    return [];
  }
}


/* ──────────────────────────────────────────────── */
/*                     AUDIO MP3                    */
/* ──────────────────────────────────────────────── */

async function audio(q) {
  try {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent("filetype:mp3 " + q)}`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await r.text();

    const links = [...html.matchAll(/https?:\/\/[^"']+?\.mp3/g)].map(m => m[0]);
    return [...new Set(links)].slice(0, 20).map(url => ({ url }));

  } catch {
    return [];
  }
}


/* ──────────────────────────────────────────────── */
/*                 RESULTADOS WEB                   */
/* ──────────────────────────────────────────────── */

async function web(q) {
  try {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await r.text();

    const results = [];
    const regex = /<a.*?class="result__a".*?href="(.*?)".*?>(.*?)<\/a>/g;

    let m;
    while ((m = regex.exec(html)) !== null && results.length < 20) {
      results.push({
        url: m[1],
        title: m[2].replace(/<[^>]+>/g, "")
      });
    }

    return results;

  } catch {
    return [];
  }
}

