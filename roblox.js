const axios = require('axios');

const GROUP_ID = parseInt(process.env.ROBLOX_GROUP_ID);
let cookie = '';
let xcsrfToken = '';

function setCookie(c) {
  cookie = c;
}

// CSRF token al
async function getXCSRF() {
  try {
    await axios.post('https://auth.roblox.com/v2/logout', {}, {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` }
    });
  } catch (err) {
    if (err.response && err.response.headers['x-csrf-token']) {
      xcsrfToken = err.response.headers['x-csrf-token'];
    }
  }
}

// Giriş doğrula
async function login() {
  await getXCSRF();
  const res = await axios.get('https://users.roblox.com/v1/users/authenticated', {
    headers: { Cookie: `.ROBLOSECURITY=${cookie}` }
  });
  return res.data;
}

// Grup rütbelerini çek
async function getGroupRoles() {
  const res = await axios.get(`https://groups.roblox.com/v1/groups/${GROUP_ID}/roles`);
  return res.data.roles;
}

// Kullanıcı adından ID al
async function getUserId(username) {
  const res = await axios.post('https://users.roblox.com/v1/usernames/users', {
    usernames: [username],
    excludeBannedUsers: false
  });
  if (res.data.data.length === 0) return null;
  return res.data.data[0].id;
}

// Kullanıcının gruptaki rütbesini kontrol et
async function getUserRankInGroup(userId) {
  try {
    const res = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
    const group = res.data.data.find(g => g.group.id === GROUP_ID);
    return group ? group.role.rank : 0;
  } catch {
    return 0;
  }
}

// Rütbe değiştir — 403 alırsa CSRF yenile ve tekrar dene
async function setRank(userId, roleId) {
  if (!xcsrfToken) await getXCSRF();

  try {
    await axios.patch(
      `https://groups.roblox.com/v1/groups/${GROUP_ID}/users/${userId}`,
      { roleId },
      {
        headers: {
          Cookie: `.ROBLOSECURITY=${cookie}`,
          'X-CSRF-TOKEN': xcsrfToken,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    // 403 → CSRF token yenile ve tekrar dene
    if (err.response && err.response.status === 403) {
      await getXCSRF();
      await axios.patch(
        `https://groups.roblox.com/v1/groups/${GROUP_ID}/users/${userId}`,
        { roleId },
        {
          headers: {
            Cookie: `.ROBLOSECURITY=${cookie}`,
            'X-CSRF-TOKEN': xcsrfToken,
            'Content-Type': 'application/json'
          }
        }
      );
    } else {
      throw err;
    }
  }
}

// Kullanıcının gruplarını çek
async function getUserGroups(userId) {
  const res = await axios.get(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
  return res.data.data;
}

module.exports = { setCookie, login, getGroupRoles, getUserId, getUserRankInGroup, setRank, getUserGroups };
