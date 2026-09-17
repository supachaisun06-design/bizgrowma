import fallbackPosts from "../data/posts.json";

export async function GET({ site }) {
  let posts = [];
  try {
    const res = await fetch('https://www.bizgrowtech.com/wp-json/wp/v2/posts?categories=60&_embed&per_page=100', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      posts = await res.json();
    } else {
      throw new Error('WP API returned ' + res.status);
    }
  } catch (e) {
    console.error("Error fetching WP posts for sitemap", e.message);
    posts = fallbackPosts;
  }

  const base = 'https://it-outsource.bizgrowtech.com';
  const locations = ['sainoi', 'bangbuathong', 'bangyai', 'bangkruai'];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${base}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  ${locations.map(loc => `
  <url>
    <loc>${base}/service/${loc}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`).join('')}
  <url>
    <loc>${base}/blog</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  ${posts.map(post => `
  <url>
    <loc>${base}/blog/${encodeURI(decodeURIComponent(post.slug))}</loc>
    <lastmod>${post.modified ? post.modified.split('T')[0] : new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`).join('')}
</urlset>`;

  return new Response(sitemap.trim(), {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
