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

// Belirli bir gruptaki kullanıcı rütbesini çek (groupId parametreli)
async function getUserRankInSpecificGroup(userId, groupId) {
  try {
    const res = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
    const group = res.data.data.find(g => g.group.id === groupId);
    return group ? group.role.rank : 0;
  } catch {
    return 0;
  }
}

// Belirli bir gruptan kullanıcıyı at (kick)
async function kickFromGroup(userId, groupId) {
  if (!xcsrfToken) await getXCSRF();

  try {
    await axios.delete(
      `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`,
      {
        headers: {
          Cookie: `.ROBLOSECURITY=${cookie}`,
          'X-CSRF-TOKEN': xcsrfToken,
        }
      }
    );
  } catch (err) {
    if (err.response && err.response.status === 403) {
      await getXCSRF();
      await axios.delete(
        `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`,
        {
          headers: {
            Cookie: `.ROBLOSECURITY=${cookie}`,
            'X-CSRF-TOKEN': xcsrfToken,
          }
        }
      );
    } else {
      throw err;
    }
  }
}

// Belirli bir gruptaki rolleri çek
async function getGroupRolesById(groupId) {
  const res = await axios.get(`https://groups.roblox.com/v1/groups/${groupId}/roles`);
  return res.data.roles;
}

// Belirli bir grupta rütbe değiştir
async function setRankInGroup(userId, roleId, groupId) {
  if (!xcsrfToken) await getXCSRF();

  try {
    await axios.patch(
      `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`,
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
    if (err.response && err.response.status === 403) {
      await getXCSRF();
      await axios.patch(
        `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`,
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

// Belirli bir gruptaki join request'i kabul et
async function acceptJoinRequest(userId, groupId) {
  if (!xcsrfToken) await getXCSRF();

  try {
    await axios.post(
      `https://groups.roblox.com/v1/groups/${groupId}/join-requests/users/${userId}`,
      {},
      {
        headers: {
          Cookie: `.ROBLOSECURITY=${cookie}`,
          'X-CSRF-TOKEN': xcsrfToken,
        }
      }
    );
  } catch (err) {
    if (err.response && err.response.status === 403) {
      await getXCSRF();
      await axios.post(
        `https://groups.roblox.com/v1/groups/${groupId}/join-requests/users/${userId}`,
        {},
        {
          headers: {
            Cookie: `.ROBLOSECURITY=${cookie}`,
            'X-CSRF-TOKEN': xcsrfToken,
          }
        }
      );
    } else {
      throw err;
    }
  }
}

// Belirli bir gruptaki join request'i reddet
async function declineJoinRequest(userId, groupId) {
  if (!xcsrfToken) await getXCSRF();

  try {
    await axios.delete(
      `https://groups.roblox.com/v1/groups/${groupId}/join-requests/users/${userId}`,
      {
        headers: {
          Cookie: `.ROBLOSECURITY=${cookie}`,
          'X-CSRF-TOKEN': xcsrfToken,
        }
      }
    );
  } catch (err) {
    if (err.response && err.response.status === 403) {
      await getXCSRF();
      await axios.delete(
        `https://groups.roblox.com/v1/groups/${groupId}/join-requests/users/${userId}`,
        {
          headers: {
            Cookie: `.ROBLOSECURITY=${cookie}`,
            'X-CSRF-TOKEN': xcsrfToken,
          }
        }
      );
    } else {
      throw err;
    }
  }
}

// Belirli bir gruptaki rolün yetkilerini çek
async function getGroupRolePermissions(groupId, roleId) {
  const res = await axios.get(
    `https://groups.roblox.com/v1/groups/${groupId}/roles/${roleId}/permissions`,
    { headers: { Cookie: `.ROBLOSECURITY=${cookie}` } }
  );
  return res.data.permissions;
}

module.exports = { setCookie, login, getGroupRoles, getGroupRolesById, getUserId, getUserRankInGroup, getUserRankInSpecificGroup, kickFromGroup, acceptJoinRequest, declineJoinRequest, getGroupRolePermissions, setRank, setRankInGroup, getUserGroups };
