import fetch from "node-fetch";
import { parseStringPromise } from "xml2js";

export default async function handler(req, res) {
  const q = (req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "missing q" });

  try {
    const [wikiResult, imagesResult, newsResult, pdfResult, audioResult, webResult] =
      await Promise.all([
        wiki(q),
        bingImages(q),
        bingNews(q),
        bingPDF(q),
        bingMP3(q),
        bingWeb(q)
      ]);

    res.setHeader("Access-Control-Allow-Origin", "*");

    res.status(200).json({
      query: q,
      wiki: wikiResult,
      images: imagesResult,
      news: newsResult,
      pdfs: pdfResult,
      audio: audioResult,
      web: webResult
    });

  } catch (e) {
    console.log(e);
    res.status(500).json({ error: e.message });
  }
}


/* ──────────────────────────────── */
/*          WIKIPEDIA              */
/* ──────────────────────────────── */
async function wiki(q) {
  try {
    const url =
      `https://es.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(q)}`;
    
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


/* ──────────────────────────────── */
/*       BING IMAGES 2025          */
/* ──────────────────────────────── */
async function bingImages(q) {
  try {
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(q)}`;
    
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await r.text();

    const matches = [...html.matchAll(/murl&quot;:&quot;(.*?)&quot;/g)];

    return matches.slice(0, 30).map(m => ({
      image: m[1],
      thumbnail: m[1],
      title: q,
      source: "bing"
    }));
  } catch {
    return [];
  }
}


/* ──────────────────────────────── */
/*           BING NEWS             */
/* ──────────────────────────────── */
async function bingNews(q) {
  try {
    const rss = `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss`;
    const r = await fetch(rss);
    const xml = await r.text();

    const parsed = await parseStringPromise(xml);
    const items = parsed.rss.channel[0].item;

    return items.slice(0, 10).map(n => ({
      title: n.title[0],
      link: n.link[0],
      date: n.pubDate[0]
    }));
  } catch {
    return [];
  }
}


/* ──────────────────────────────── */
/*          BING PDF SEARCH        */
/* ──────────────────────────────── */
async function bingPDF(q) {
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(q + " filetype:pdf")}`;
    
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await r.text();

    const pdfs = [...html.matchAll(/https?:\/\/[^"']+?\.pdf/g)].map(m => m[0]);

    return [...new Set(pdfs)].slice(0, 20).map(url => ({ url }));

  } catch {
    return [];
  }
}


/* ──────────────────────────────── */
/*          BING MP3 SEARCH        */
/* ──────────────────────────────── */
async function bingMP3(q) {
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(q + " filetype:mp3")}`;
    
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await r.text();

    const mp3 = [...html.matchAll(/https?:\/\/[^"']+?\.mp3/g)].map(m => m[0]);

    return [...new Set(mp3)].slice(0, 20).map(url => ({ url }));

  } catch {
    return [];
  }
}


/* ──────────────────────────────── */
/*         BING WEB RESULTS        */
/* ──────────────────────────────── */
async function bingWeb(q) {
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await r.text();

    const results = [];

    const regex = /<h2><a href="(.*?)".*?>(.*?)<\/a>/g;

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


