import 'dotenv/config';
import fetch from 'node-fetch';

const WP_URL = process.env.WP_URL || 'https://www.revistaautadesouza.com/index.php';
const WP_USER = process.env.WP_ADMIN_USER;
const WP_PASS = process.env.WP_ADMIN_PASS;

async function testConnection() {
  console.log(`🔍 Testing connection to WordPress REST API at: ${WP_URL}`);

  const authHeader = 'Basic ' + Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');

  try {
    // 1. Test public API
    const publicRes = await fetch(`${WP_URL}/wp-json/wp/v2/posts?per_page=1`);
    if (!publicRes.ok) {
      throw new Error(`Public API failed with status ${publicRes.status}: ${publicRes.statusText}`);
    }
    const totalPosts = publicRes.headers.get('x-wp-total') || 'Unknown';
    console.log(`✅ Public API connected! Total public posts detected: ${totalPosts}`);

    // 2. Test authenticated API (users/me endpoint)
    const authRes = await fetch(`${WP_URL}/wp-json/wp/v2/users/me`, {
      headers: {
        'Authorization': authHeader
      }
    });

    if (authRes.status === 401 || authRes.status === 403) {
      console.log(`⚠️ Authenticated request returned HTTP ${authRes.status}.`);
      console.log(`👉 Standard password authentication might be blocked by WP REST API security settings.`);
      console.log(`👉 You may need to create an Application Password in WP Admin (Users > Profile > Application Passwords).`);
    } else if (authRes.ok) {
      const totalPages = authRes.headers.get('x-wp-total') || 'Unknown';
      console.log(`🔑 Authenticated access SUCCESSFUL! Total pages (including drafts/private): ${totalPages}`);
    } else {
      const errText = await authRes.text();
      console.log(`ℹ️ Auth response status: ${authRes.status} ${authRes.statusText}`);
      console.log(`ℹ️ Auth response body: ${errText.substring(0, 300)}`);
    }

  } catch (err) {
    console.error(`❌ Connection test failed:`, err.message);
  }
}

testConnection();
