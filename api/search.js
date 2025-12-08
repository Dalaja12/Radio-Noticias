import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";

export default async function handler(req, res) {
  const q = (req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "Missing q" });

  try {
    // Ejecutamos todas las búsquedas a la vez
    const results = await Promise.all([
      wiki(q),
      images(q),
      news(q),
      pdfs(q),
      audio(q),
      web(q)
    ]);

    res.status(200).json({
      query: q,
      wiki: results[0],
      images: results[1],
      news: results[2],
      pdfs: results[3],
      audio: results[4],
      web: results[5]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search proxy failed", details: err.message });
  }
}


/* ───────────────────────────────────────────────────────────── */
/*                         WIKIPEDIA                             */
/* ───────────────────────────────────────────────────────────── */

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


/* ───────────────────────────────────────────────────────────── */
/*                         IMÁGENES                              */
/* ───────────────────────────────────────────────────────────── */

async function images(q) {
  try {
    const url = `https://duckduckgo.com/i.js?o=json&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla" } });
    const j = await r.json();

    return j.results?.map(i => ({
      image: i.image,
      thumbnail: i.thumbnail,
      title: i.title,
      source: i.url
    })) || [];

  } catch {
    return [];
  }
}


/* ───────────────────────────────────────────────────────────── */
/*                         NOTICIAS                               */
/* ───────────────────────────────────────────────────────────── */

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


/* ───────────────────────────────────────────────────────────── */
/*                           PDFS                                 */
/* ───────────────────────────────────────────────────────────── */

async function pdfs(q) {
  try {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent("filetype:pdf " + q)}`;
    const r = await fetch(url);
    const html = await r.text();

    const pdfs = [...html.matchAll(/https?:\/\/[^"']+?\.pdf/g)].map(m => m[0]);
    return [...new Set(pdfs)].slice(0, 20).map(url => ({ url }));

  } catch {
    return [];
  }
}


/* ───────────────────────────────────────────────────────────── */
/*                          AUDIO MP3                              */
/* ───────────────────────────────────────────────────────────── */

async function audio(q) {
  try {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent("filetype:mp3 " + q)}`;
    const r = await fetch(url);
    const html = await r.text();

    const links = [...html.matchAll(/https?:\/\/[^"']+?\.mp3/g)].map(m => m[0]);

    return [...new Set(links)].slice(0, 20).map(url => ({ url }));

  } catch {
    return [];
  }
}


/* ───────────────────────────────────────────────────────────── */
/*                   RESULTADOS WEB GENERALES                     */
/* ───────────────────────────────────────────────────────────── */

async function web(q) {
  try {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    const r = await fetch(url);
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
