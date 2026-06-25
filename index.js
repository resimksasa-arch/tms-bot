    
    require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const roblox = require('./roblox');
const fs = require('fs');
const axios = require('axios');
const express = require('express');

// HTTP sunucusu — Roblox'tan gelen verileri alır
const app = express();
app.use(express.json());

// Oyundaki oyuncular
const oyuncular = {}; // { username: { joinTime: Date } }

// Gizli key — Roblox scriptinde aynı olmalı
const WEBHOOK_SECRET = 'TMS_SECRET_KEY_2024';

app.post('/oyuncu', (req, res) => {
  const { secret, username, action } = req.body;
  if (secret !== WEBHOOK_SECRET) return res.status(403).json({ error: 'Yetkisiz' });

  if (action === 'join') {
    oyuncular[username] = { joinTime: Date.now() };
  } else if (action === 'leave') {
    delete oyuncular[username];
  }
  res.json({ success: true });
});

app.get('/health', (req, res) => res.send('OK'));

app.listen(3000, () => console.log('✅ HTTP sunucusu 3000 portunda çalışıyor'));

const BRANS_GRUPLARI = {
  '511181149': 'JGK',
  '627383677': 'Hava',
  '858980946': 'AS.İZ',
  '528755654': 'SM',
  '677805553': 'ÖKK',
  '804959765': 'KK',
};

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// Ticket verisi
function loadTickets() {
  try { return JSON.parse(fs.readFileSync('./tickets.json', 'utf8')); }
  catch { return {}; }
}
function saveTickets(data) {
  fs.writeFileSync('./tickets.json', JSON.stringify(data, null, 2));
}

async function loginRoblox() {
  try {
    roblox.setCookie(process.env.ROBLOX_COOKIE);
    const user = await roblox.login();
    console.log(`✅ Roblox'a giriş yapıldı: ${user.name}`);
  } catch (err) {
    console.error('❌ Roblox giriş hatası:', err.message);
    process.exit(1);
  }
}

client.once('clientReady', async () => {
  console.log(`✅ Discord botu hazır: ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: 'Made by Ryena', type: 4 }],
    status: 'online'
  });
  await loginRoblox();
});

const commandConfig = {
  'rütbe-ver':  { color: 0x2ecc71, emoji: '🏅', baslik: 'Rütbe Verildi'  },
  'terfi-ver':  { color: 0xf1c40f, emoji: '⬆️', baslik: 'Terfi Edildi'   },
  'tenzil-ver': { color: 0xe74c3c, emoji: '⬇️', baslik: 'Tenzil Edildi'  },
};

const errorEmbed = (title, desc) =>
  new EmbedBuilder().setColor(0xff4757).setTitle(`❌ ${title}`).setDescription(desc).setTimestamp();

// RoWifi ile kullanıcının Roblox ID ve adını al
async function getVerifiedRoblox(guildId, discordUserId) {
  const rowifiRes = await axios.get(
    `https://api.rowifi.xyz/v2/guilds/${guildId}/members/${discordUserId}`,
    { headers: { 'Authorization': `Bot ${process.env.ROWIFI_API_KEY}` } }
  );
  const robloxId = rowifiRes.data.roblox_id;
  if (!robloxId) throw new Error('roblox_id bulunamadı');
  const robloxUserRes = await axios.get(`https://users.roblox.com/v1/users/${robloxId}`);
  return { id: robloxId, name: robloxUserRes.data.name };
}

// Ticket transcript oluştur
async function createTranscript(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sorted = [...messages.values()].reverse();
    let transcript = `📋 TICKET TRANSCRIPT - #${channel.name}\n`;
    transcript += `Tarih: ${new Date().toLocaleString('tr-TR')}\n`;
    transcript += '═'.repeat(50) + '\n\n';
    for (const msg of sorted) {
      if (msg.author.bot) continue;
      transcript += `[${msg.createdAt.toLocaleString('tr-TR')}] ${msg.author.tag}:\n${msg.content || '[Embed/Dosya]'}\n\n`;
    }
    return transcript;
  } catch { return 'Transcript oluşturulamadı.'; }
}

client.on('interactionCreate', async interaction => {

  // ── AUTOCOMPLETE ──
  if (interaction.isAutocomplete()) {
    const cmd = interaction.commandName;

    // Branş rütbe autocomplete
    if (cmd === 'branş-rütbe-ver') {
      try {
        const groupIdStr = interaction.options.getString('branş');
        if (!groupIdStr) return await interaction.respond([]);
        const groupId = parseInt(groupIdStr);
        const roles = await roblox.getGroupRolesById(groupId);
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const sorted = roles.filter(r => r.rank > 0).sort((a, b) => a.rank - b.rank);
        const filtered = (focusedValue
          ? sorted.filter(r => r.name.toLowerCase().includes(focusedValue) || String(r.rank).includes(focusedValue))
          : sorted
        ).slice(0, 25).map(r => ({ name: `[${r.rank}] ${r.name}`, value: String(r.id) }));
        await interaction.respond(filtered);
      } catch { await interaction.respond([]); }
      return;
    }

    if (!(cmd in commandConfig)) return;
    try {
      const roles = await roblox.getGroupRoles();
      const focusedValue = interaction.options.getFocused().toLowerCase();
      const sorted = roles.filter(r => r.rank > 0).sort((a, b) => a.rank - b.rank);
      const filtered = (focusedValue
        ? sorted.filter(r => r.name.toLowerCase().includes(focusedValue) || String(r.rank).includes(focusedValue))
        : sorted
      ).slice(0, 25).map(r => ({ name: `[${r.rank}] ${r.name}`, value: String(r.id) }));
      await interaction.respond(filtered);
    } catch { await interaction.respond([]); }
    return;
  }

  // ── BUTON VE MENÜ ──
  if (interaction.isStringSelectMenu()) {
    // Ticket kategorisi seçildi
    if (interaction.customId === 'ticket_kategori') {
      const kategori = interaction.values[0];
      const guild = interaction.guild;
      const user = interaction.user;
      const tickets = loadTickets();

      // Zaten açık ticket var mı?
      const mevcutTicket = Object.values(tickets).find(t => t.userId === user.id && t.durum === 'acik');
      if (mevcutTicket) {
        return interaction.reply({
          embeds: [errorEmbed('Zaten Açık Ticket Var', `Zaten açık bir ticketın var: <#${mevcutTicket.kanalId}>`)],
          ephemeral: true
        });
      }

      const kategoriIsim = { transfer: '📦 Transfer', sikayet: '🎮 Oyun İçi Şikayet', diger: '📋 Diğer' };
      const ticketNo = Date.now().toString().slice(-5);
      const kanalAdi = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${ticketNo}`;

      try {
        // Kanal oluştur
        const kanalPermissions = [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: process.env.TICKET_YETKILI_ROL_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        ];

        const ticketKanal = await guild.channels.create({
          name: kanalAdi,
          type: ChannelType.GuildText,
          parent: process.env.TICKET_AKTIF_KATEGORI_ID,
          permissionOverwrites: kanalPermissions
        });

        // Ticket verisini kaydet
        tickets[ticketKanal.id] = {
          kanalId: ticketKanal.id,
          userId: user.id,
          userTag: user.tag,
          kategori,
          durum: 'acik',
          acilisTarihi: new Date().toISOString()
        };
        saveTickets(tickets);

        // Ticket kanalına mesaj gönder
        const ticketEmbed = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle(`🎫 ${kategoriIsim[kategori]}`)
          .setDescription([
            `Merhaba ${user}, ticketın oluşturuldu!`,
            '',
            '📝 Lütfen sorununuzu detaylıca açıklayın.',
            '⏳ Yetkililer en kısa sürede ilgilenecektir.',
          ].join('\n'))
          .addFields(
            { name: '👤 Açan', value: `${user}`, inline: true },
            { name: '📂 Kategori', value: kategoriIsim[kategori], inline: true },
            { name: '🕐 Tarih', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
          )
          .setTimestamp();

        const butonlar = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket_kapat').setLabel('🔒 Ticketı Kapat').setStyle(ButtonStyle.Danger),
        );

        await ticketKanal.send({ content: `${user} <@&${process.env.TICKET_YETKILI_ROL_ID}>`, embeds: [ticketEmbed], components: [butonlar] });

        // Transfer kategorisiyse format otomatik gönder
        if (kategori === 'transfer') {
          const transferRolId = process.env.TRANSFER_YETKILI_ROL_ID || process.env.TICKET_YETKILI_ROL_ID;
          const formatMesaj = [
            `@Transfer Yetkilisi`,
            ``,
            `**İsim:**`,
            `**Oynadığım Kamplar:**`,
            `**Tecrübelerim:**`,
            `**SS:**`,
            `**Tag:** <@&${process.env.TRANSFER_YETKILI_ROL_ID}>`,
          ].join('\n');

          await ticketKanal.send({ 
            content: formatMesaj,
            allowedMentions: { roles: [process.env.TRANSFER_YETKILI_ROL_ID] }
          });
        }

        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`✅ Ticketın oluşturuldu: ${ticketKanal}`)],
          ephemeral: true
        });

      } catch (err) {
        console.error('Ticket oluşturma hatası:', err.message);
        await interaction.reply({ embeds: [errorEmbed('Hata', err.message)], ephemeral: true });
      }
    }
    return;
  }

  if (interaction.isButton()) {
    const tickets = loadTickets();
    const ticketData = tickets[interaction.channelId];

    // Ticket kapat
    if (interaction.customId === 'ticket_kapat') {
      if (!ticketData) return interaction.reply({ content: 'Bu bir ticket kanalı değil.', ephemeral: true });

      await interaction.deferReply({ ephemeral: false });

      // Transcript oluştur
      const transcript = await createTranscript(interaction.channel);
      const transcriptBuffer = Buffer.from(transcript, 'utf8');

      // Log kanalına transcript gönder
      const logKanal = client.channels.cache.get(process.env.TICKET_LOG_KANAL_ID);
      if (logKanal) {
        const logEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('🔒 Ticket Kapatıldı')
          .addFields(
            { name: '👤 Ticket Sahibi', value: `<@${ticketData.userId}> (${ticketData.userTag})`, inline: true },
            { name: '📂 Kategori', value: ticketData.kategori, inline: true },
            { name: '🔒 Kapatan', value: `${interaction.user}`, inline: true },
            { name: '🕐 Tarih', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
          )
          .setTimestamp();

        await logKanal.send({
          embeds: [logEmbed],
          files: [{ attachment: transcriptBuffer, name: `ticket-${interaction.channel.name}.txt` }]
        });
      }

      // Kanalı kapalı kategoriye taşı ve izinleri güncelle
      await interaction.channel.setParent(process.env.TICKET_KAPALI_KATEGORI_ID, { lockPermissions: false });
      await interaction.channel.permissionOverwrites.edit(ticketData.userId, { SendMessages: false });

      // Ticket durumunu güncelle
      tickets[interaction.channelId].durum = 'kapali';
      tickets[interaction.channelId].kapanisTarihi = new Date().toISOString();
      tickets[interaction.channelId].kapatan = interaction.user.tag;
      saveTickets(tickets);

      // Yeni butonlar — sadece yetkililer görebilir
      const yeniButonlar = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_ac').setLabel('🔓 Ticketı Yeniden Aç').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('ticket_sil').setLabel('🗑️ Ticketı Sil').setStyle(ButtonStyle.Danger),
      );

      const kapatmaEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('🔒 Ticket Kapatıldı')
        .setDescription(`Bu ticket **${interaction.user}** tarafından kapatıldı.`)
        .setTimestamp();

      await interaction.editReply({ embeds: [kapatmaEmbed], components: [yeniButonlar] });
    }

    // Ticket yeniden aç
    if (interaction.customId === 'ticket_ac') {
      if (!interaction.member.roles.cache.has(process.env.TICKET_YETKILI_ROL_ID)) {
        return interaction.reply({ embeds: [errorEmbed('Yetersiz Yetki', 'Sadece yetkililer ticket açabilir.')], ephemeral: true });
      }
      if (!ticketData) return;

      await interaction.channel.setParent(process.env.TICKET_AKTIF_KATEGORI_ID, { lockPermissions: false });
      await interaction.channel.permissionOverwrites.edit(ticketData.userId, { SendMessages: true, ViewChannel: true });

      tickets[interaction.channelId].durum = 'acik';
      delete tickets[interaction.channelId].kapanisTarihi;
      saveTickets(tickets);

      const acmaEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('🔓 Ticket Yeniden Açıldı')
        .setDescription(`Bu ticket **${interaction.user}** tarafından yeniden açıldı.`)
        .setTimestamp();

      const butonlar = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_kapat').setLabel('🔒 Ticketı Kapat').setStyle(ButtonStyle.Danger),
      );

      await interaction.reply({ embeds: [acmaEmbed], components: [butonlar] });
    }

    // Ticket sil
    if (interaction.customId === 'ticket_sil') {
      if (!interaction.member.roles.cache.has(process.env.TICKET_YETKILI_ROL_ID)) {
        return interaction.reply({ embeds: [errorEmbed('Yetersiz Yetki', 'Sadece yetkililer ticket silebilir.')], ephemeral: true });
      }

      await interaction.reply({ content: '🗑️ Ticket 3 saniye içinde silinecek...', ephemeral: false });
      delete tickets[interaction.channelId];
      saveTickets(tickets);
      setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }

    return;
  }

  if (!interaction.isChatInputCommand()) return;
  const cmd = interaction.commandName;

  // ── /PING ──
  if (cmd === 'ping') {
    const latency = Date.now() - interaction.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🏓 Pong!')
      .addFields(
        { name: '⏱️ Bot Gecikmesi', value: `\`${latency}ms\``, inline: true },
        { name: '💡 API Gecikmesi', value: `\`${apiLatency}ms\``, inline: true }
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
    return;
  }

  // ── /OYUN KOMUTLARI ──
  if (['oyun-ban', 'oyun-globalban', 'oyun-kick', 'oyun-fly', 'oyun-shutdown'].includes(cmd)) {
    await interaction.deferReply({ ephemeral: false });

    const roleId = process.env.OYUN_YETKILI_ROL_ID;
    console.log(`[OYUN] Komut: ${cmd}, User: ${interaction.user.id}, Rol gereksiz: ${roleId}, Sahip olduğu roller: ${[...interaction.member.roles.cache.keys()].join(',')}`);
    
    if (!roleId) {
      return interaction.editReply({ embeds: [errorEmbed('Hata', 'OYUN_YETKILI_ROL_ID env variable set edilmemiş.')] });
    }
    
    if (!interaction.member.roles.cache.has(roleId)) {
      return interaction.editReply({ embeds: [errorEmbed('Yetersiz Yetki', `Bu komutu kullanmak için **Holder** rolüne (<@&${roleId}>) sahip olman lazım.`)] });
    }

    const kullanici = interaction.options.getString('kullanici') || null;
    const sebep = interaction.options.getString('sebep') || 'Sebep belirtilmedi';

    const komutMap = {
      'oyun-ban': 'ban',
      'oyun-globalban': 'globalban',
      'oyun-kick': 'kick',
      'oyun-fly': 'fly',
      'oyun-shutdown': 'shutdown',
    };
    const komut = komutMap[cmd];

    // Kuyruğa ekle
    commandQueue.push({
      id: Date.now(),
      komut,
      hedef: kullanici,
      sebep,
      yapan: interaction.user.tag,
      zaman: new Date().toISOString(),
    });

    const komutEmojileri = { ban: '🔨', globalban: '🌐🔨', kick: '👢', fly: '✈️', shutdown: '🔴' };
    const embed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle(`${komutEmojileri[komut]} Oyun Komutu Kuyruğa Eklendi`)
      .addFields(
        { name: '⚙️ Komut', value: `\`${komut}\``, inline: true },
        { name: '👤 Hedef', value: kullanici || '—', inline: true },
        { name: '📝 Sebep', value: sebep, inline: false },
        { name: '🛡️ Yapan', value: `${interaction.user}`, inline: true },
      )
      .setDescription('Komut oyun sunucusu tarafından alınınca uygulanacak.')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // ── /BRANŞ-RÜTBE-VER ──
  if (cmd === 'branş-rütbe-ver') {
    await interaction.deferReply({ ephemeral: false });

    const hedefAdi   = interaction.options.getString('kullanici');
    const groupIdStr = interaction.options.getString('branş');
    const roleId     = parseInt(interaction.options.getString('rütbe'));
    const sebep      = interaction.options.getString('sebep');
    const groupId    = parseInt(groupIdStr);
    const bransAdi   = BRANS_GRUPLARI[groupIdStr];

    // 1. RoWifi ile komutu kullananın Roblox hesabını doğrula
    let veren;
    try {
      veren = await getVerifiedRoblox(interaction.guildId, interaction.user.id);
    } catch (err) {
      console.error('branş-rütbe-ver RoWifi hata:', err?.response?.status, JSON.stringify(err?.response?.data), err.message);
      return interaction.editReply({ embeds: [errorEmbed('Hesap Doğrulanmamış', `RoWifi ile Roblox hesabın doğrulanmamış. \`/verify\` komutunu kullan.\n\`${err.message}\``)] });
    }
    const verenId = veren.id;
    const verenAdi = veren.name;

    // 2. Rütbeleri al ve hedef rütbeyi bul
    const roles = await roblox.getGroupRolesById(groupId);
    const targetRole = roles.find(r => r.id === roleId);
    if (!targetRole) {
      return interaction.editReply({ embeds: [errorEmbed('Geçersiz Rütbe', 'Seçilen rütbe bulunamadı.')] });
    }

    // 3. Kullananın branş grubundaki rütbesini kontrol et
    const verenRank = await roblox.getUserRankInSpecificGroup(verenId, groupId);
    if (verenRank === 0) {
      return interaction.editReply({ embeds: [errorEmbed('Yetersiz Yetki', `**${bransAdi}** branşında üye değilsin.`)] });
    }
    if (targetRole.rank >= verenRank) {
      return interaction.editReply({ embeds: [errorEmbed('Yetersiz Rütbe', `Kendi rütbenden (**Rank ${verenRank}**) eşit veya yüksek rütbe veremezsin.\nSeçilen: \`[${targetRole.rank}] ${targetRole.name}\``)] });
    }

    // 4. Hedef kullanıcıyı bul
    const hedefId = await roblox.getUserId(hedefAdi);
    if (!hedefId) {
      return interaction.editReply({ embeds: [errorEmbed('Bulunamadı', `**${hedefAdi}** adlı Roblox kullanıcısı bulunamadı.`)] });
    }

    // Kendine rütbe veremesin
    if (hedefId === verenId) {
      return interaction.editReply({ embeds: [errorEmbed('Geçersiz İşlem', 'Kendine rütbe veremezsin.')] });
    }

    const hedefRank = await roblox.getUserRankInSpecificGroup(hedefId, groupId);
    if (hedefRank === 0) {
      return interaction.editReply({ embeds: [errorEmbed('Hedef Grupta Değil', `**${hedefAdi}**, **${bransAdi}** branşında üye değil.`)] });
    }

    // 5. Rütbe değiştir
    try {
      await roblox.setRankInGroup(hedefId, roleId, groupId);
    } catch (err) {
      return interaction.editReply({ embeds: [errorEmbed('Hata', `Rütbe değiştirilemedi: \`${err.message}\``)] });
    }

    const avatarUrl = `https://www.roblox.com/headshot-thumbnail/image?userId=${hedefId}&width=420&height=420&format=png`;

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setAuthor({ name: `🏅 Branş Rütbesi Verildi`, iconURL: interaction.guild.iconURL({ dynamic: true }) ?? undefined })
      .setThumbnail(avatarUrl)
      .addFields(
        { name: '👤 Hedef Kullanıcı', value: `[${hedefAdi}](https://www.roblox.com/users/${hedefId}/profile)`, inline: true },
        { name: '🪖 Branş', value: bransAdi, inline: true },
        { name: '🏅 Verilen Rütbe', value: `\`[${targetRole.rank}] ${targetRole.name}\``, inline: true },
        { name: '📝 Sebep', value: sebep, inline: false },
        { name: '🛡️ İşlemi Yapan', value: `${interaction.user} (${verenAdi})`, inline: true },
        { name: '🕐 Tarih', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
      )
      .setFooter({ text: `Roblox ID: ${hedefId}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    const logChannel = client.channels.cache.get(process.env.LOG_CHANNEL_ID);
    if (logChannel && logChannel.id !== interaction.channelId) {
      await logChannel.send({ embeds: [embed] });
    }
    return;
  }

  // ── /BRANŞ-İSTEK ──
  if (cmd === 'branş-istek') {
    await interaction.deferReply({ ephemeral: false });

    const hedefAdi   = interaction.options.getString('kullanici');
    const groupIdStr = interaction.options.getString('branş');
    const sebep      = interaction.options.getString('sebep');
    const groupId    = parseInt(groupIdStr);
    const bransAdi   = BRANS_GRUPLARI[groupIdStr];

    // 1. RoWifi ile komutu kullananın Roblox hesabını doğrula
    let veren;
    try {
      veren = await getVerifiedRoblox(interaction.guildId, interaction.user.id);
    } catch (err) {
      console.error('branş-istek RoWifi hata:', err?.response?.status, JSON.stringify(err?.response?.data), err.message);
      return interaction.editReply({ embeds: [errorEmbed('Hesap Doğrulanmamış', `RoWifi ile Roblox hesabın doğrulanmamış. \`/verify\` komutunu kullan.\n\`${err.message}\``)] });
    }
    const verenId = veren.id;
    const verenAdi = veren.name;

    // 2. Kullananın branş grubundaki rolünü bul
    let verenRoleId = null;
    try {
      const grupRes = await axios.get(`https://groups.roblox.com/v1/users/${verenId}/groups/roles`);
      const grupBilgi = grupRes.data.data.find(g => g.group.id === groupId);
      if (!grupBilgi) {
        return interaction.editReply({ embeds: [errorEmbed('Yetersiz Yetki', `**${bransAdi}** branşında üye değilsin.`)] });
      }
      verenRoleId = grupBilgi.role.id;
    } catch (err) {
      return interaction.editReply({ embeds: [errorEmbed('Hata', `Grup bilgisi alınamadı: \`${err.message}\``)] });
    }

    // 3. Rolün join request yönetme yetkisi var mı kontrol et
    try {
      const perms = await roblox.getGroupRolePermissions(groupId, verenRoleId);
      if (!perms.groupMembershipPermissions?.inviteMembers) {
        return interaction.editReply({ embeds: [errorEmbed('Yetersiz Yetki', `**${bransAdi}** branşında istek kabul etme yetkin yok.`)] });
      }
    } catch (err) {
      return interaction.editReply({ embeds: [errorEmbed('Hata', `Yetki kontrolü yapılamadı: \`${err.message}\``)] });
    }

    // 4. Hedef kullanıcının ID'sini al
    const hedefId = await roblox.getUserId(hedefAdi);
    if (!hedefId) {
      return interaction.editReply({ embeds: [errorEmbed('Bulunamadı', `**${hedefAdi}** adlı Roblox kullanıcısı bulunamadı.`)] });
    }

    // 5. İsteği kabul et
    try {
      await roblox.acceptJoinRequest(hedefId, groupId);
    } catch (err) {
      // 400 genellikle "istek yok" anlamına gelir
      if (err.response?.status === 400) {
        return interaction.editReply({ embeds: [errorEmbed('İstek Bulunamadı', `**${hedefAdi}** adlı kullanıcının **${bransAdi}** grubuna bekleyen bir katılım isteği yok.`)] });
      }
      return interaction.editReply({ embeds: [errorEmbed('Hata', `İstek kabul edilemedi: \`${err.message}\``)] });
    }

    const avatarUrl = `https://www.roblox.com/headshot-thumbnail/image?userId=${hedefId}&width=420&height=420&format=png`;

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setAuthor({ name: `✅ Branş İsteği Kabul Edildi`, iconURL: interaction.guild.iconURL({ dynamic: true }) ?? undefined })
      .setThumbnail(avatarUrl)
      .addFields(
        { name: '👤 Kabul Edilen', value: `[${hedefAdi}](https://www.roblox.com/users/${hedefId}/profile)`, inline: true },
        { name: '🪖 Branş', value: bransAdi, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '📝 Sebep', value: sebep, inline: false },
        { name: '🛡️ İşlemi Yapan', value: `${interaction.user} (${verenAdi})`, inline: true },
        { name: '🕐 Tarih', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
      )
      .setFooter({ text: `Roblox ID: ${hedefId}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    const logChannel = client.channels.cache.get(process.env.LOG_CHANNEL_ID);
    if (logChannel && logChannel.id !== interaction.channelId) {
      await logChannel.send({ embeds: [embed] });
    }
    return;
  }

  // ── /BRANŞ-AT ──
  if (cmd === 'branş-at') {
    await interaction.deferReply({ ephemeral: false });

    const hedefAdi  = interaction.options.getString('kullanici');
    const groupIdStr = interaction.options.getString('branş');
    const sebep     = interaction.options.getString('sebep');
    const groupId   = parseInt(groupIdStr);
    const bransAdi  = BRANS_GRUPLARI[groupIdStr];

    // 1. RoWifi ile komutu kullananın Roblox hesabını doğrula
    let veren;
    try {
      veren = await getVerifiedRoblox(interaction.guildId, interaction.user.id);
    } catch (err) {
      console.error('branş-at RoWifi hata:', err?.response?.status, JSON.stringify(err?.response?.data), err.message);
      return interaction.editReply({ embeds: [errorEmbed('Hesap Doğrulanmamış', `RoWifi ile Roblox hesabın doğrulanmamış. \`/verify\` komutunu kullan.\n\`${err.message}\``)] });
    }
    const verenId = veren.id;
    const verenAdi = veren.name;

    // 2. Hedef kullanıcının ID'sini al
    const hedefId = await roblox.getUserId(hedefAdi);
    if (!hedefId) {
      return interaction.editReply({ embeds: [errorEmbed('Bulunamadı', `**${hedefAdi}** adlı Roblox kullanıcısı bulunamadı.`)] });
    }

    // 3. Kendini atamaz
    if (hedefId === verenId) {
      return interaction.editReply({ embeds: [errorEmbed('Geçersiz İşlem', 'Kendini gruptan atamazsın.')] });
    }

    // 4. Rütbe kontrolü — her iki kullanıcının branş grubundaki rütbesine bak
    const verenRank  = await roblox.getUserRankInSpecificGroup(verenId,  groupId);
    const hedefRank  = await roblox.getUserRankInSpecificGroup(hedefId, groupId);

    if (verenRank === 0) {
      return interaction.editReply({ embeds: [errorEmbed('Yetersiz Yetki', `**${bransAdi}** branşında üye değilsin.`)] });
    }
    if (hedefRank === 0) {
      return interaction.editReply({ embeds: [errorEmbed('Hedef Grupta Değil', `**${hedefAdi}**, **${bransAdi}** branşında üye değil.`)] });
    }
    if (hedefRank >= verenRank) {
      return interaction.editReply({ embeds: [errorEmbed('Yetersiz Rütbe', `Kendi rütbenden (**Rank ${verenRank}**) eşit veya yüksek rütbeli birini atamazsın.\nHedef rütbesi: **Rank ${hedefRank}**`)] });
    }

    // 5. Gruptan at
    try {
      await roblox.kickFromGroup(hedefId, groupId);
    } catch (err) {
      return interaction.editReply({ embeds: [errorEmbed('Hata', `Kullanıcı gruptan atılamadı: \`${err.message}\``)] });
    }

    const avatarUrl = `https://www.roblox.com/headshot-thumbnail/image?userId=${hedefId}&width=420&height=420&format=png`;

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setAuthor({ name: `🚫 Branştan Atıldı`, iconURL: interaction.guild.iconURL({ dynamic: true }) ?? undefined })
      .setThumbnail(avatarUrl)
      .addFields(
        { name: '👤 Atılan Kullanıcı', value: `[${hedefAdi}](https://www.roblox.com/users/${hedefId}/profile)`, inline: true },
        { name: '🪖 Branş', value: bransAdi, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '📝 Sebep', value: sebep, inline: false },
        { name: '🛡️ İşlemi Yapan', value: `${interaction.user} (${verenAdi})`, inline: true },
        { name: '🕐 Tarih', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
      )
      .setFooter({ text: `Roblox ID: ${hedefId}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Log kanalına gönder
    const logChannel = client.channels.cache.get(process.env.LOG_CHANNEL_ID);
    if (logChannel && logChannel.id !== interaction.channelId) {
      await logChannel.send({ embeds: [embed] });
    }
    return;
  }

  // ── /ASKERLER ──
  if (cmd === 'askerler') {
    await interaction.deferReply({ ephemeral: false });

    const liste = Object.entries(oyuncular);
    if (liste.length === 0) {
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x95a5a6).setTitle('👥 Oyundaki Askerler').setDescription('Şu an oyunda kimse yok.').setTimestamp()] });
    }

    const simdi = Date.now();
    const satirlar = liste.map(([username, data]) => {
      const sure = Math.floor((simdi - data.joinTime) / 60000);
      const sureStr = sure < 60 ? `${sure} dk` : `${Math.floor(sure/60)} sa ${sure%60} dk`;
      return `👤 **${username}** — ${sureStr}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`🎮 Oyundaki Askerler (${liste.length} kişi)`)
      .setDescription(satirlar.join('\n'))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // ── /AKTİFLİK ──
  if (cmd === 'aktiflik') {
    await interaction.deferReply({ ephemeral: false });
    try {
      const universeId = 10199585255;
      const res = await axios.get(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
      
      if (!res.data || !res.data.data || res.data.data.length === 0) {
        return interaction.editReply({ embeds: [errorEmbed('Hata', 'Oyun bulunamadı.')] });
      }
      
      const oyun = res.data.data[0];

      const embed = new EmbedBuilder()
        .setColor(oyun.playing > 0 ? 0x2ecc71 : 0x95a5a6)
        .setTitle('🎮 Oyun Aktiflik Durumu')
        .setThumbnail(`https://www.roblox.com/asset-thumbnail/image?assetId=${oyun.rootPlaceId}&width=768&height=432&format=png`)
        .addFields(
          { name: '🎮 Oyun', value: oyun.name, inline: false },
          { name: '👥 Şu An Oynayan', value: `**${oyun.playing.toLocaleString()}** kişi`, inline: true },
          { name: '👁️ Ziyaretçi', value: `**${oyun.visits.toLocaleString()}** toplam`, inline: true },
          { name: '❤️ Beğeni', value: `**${oyun.favoritedCount?.toLocaleString() || '?'}**`, inline: true },
          { name: '🔗 Oyun Linki', value: `[Oyuna Gir](https://www.roblox.com/games/${oyun.rootPlaceId})`, inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply({ embeds: [errorEmbed('Hata', `Oyun bilgisi alınamadı: ${err.message}`)] });
    }
    return;
  }

  // ── /GRUP ──
  if (cmd === 'grup') {
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🎖️ | TMS | Turkish Military Simulatör')
      .setDescription('Grubumuza katılmak için aşağıdaki linke tıkla!')
      .addFields(
        { name: '🔗 Grup Linki', value: '[Gruba Katıl](https://www.roblox.com/groups/493884664)' },
        { name: '🎮 Oyun Linki', value: '[Oyunu Oyna](https://www.roblox.com/tr/games/138943597146402/T-rk-Asker-Oyunu)' }
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
    return;
  }

  // ── /TAMYASAKLA ──
  if (cmd === 'tamyasakla') {
    await interaction.deferReply({ ephemeral: false });

    if (!interaction.member.roles.cache.has(process.env.YETKILI_ROL_ID)) {
      return interaction.editReply({ embeds: [errorEmbed('Yetersiz Yetki', 'Bu komutu kullanmak için yetkin yok.')] });
    }

    const hedefKullanici = interaction.options.getUser('kullanici');
    const sebep = interaction.options.getString('sebep');
    const sunucular = process.env.BAGLI_SUNUCULAR.split(',').map(s => s.trim()).filter(Boolean);

    const sonuclar = [];
    for (const sunucuId of sunucular) {
      try {
        const sunucu = client.guilds.cache.get(sunucuId);
        if (!sunucu) { sonuclar.push(`⚠️ \`${sunucuId}\` — Bot bu sunucuda değil`); continue; }
        await sunucu.members.ban(hedefKullanici.id, { reason: `[TAM YASAK] ${sebep} | Yapan: ${interaction.user.tag}` });
        sonuclar.push(`✅ **${sunucu.name}** — Banlandı`);
      } catch (err) {
        sonuclar.push(`❌ \`${sunucuId}\` — ${err.message}`);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🔨 Tam Yasaklama')
      .setThumbnail(hedefKullanici.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 Kullanıcı', value: `${hedefKullanici} (${hedefKullanici.tag})`, inline: true },
        { name: '🛡️ Yapan', value: `${interaction.user}`, inline: true },
        { name: '📝 Sebep', value: sebep, inline: false },
        { name: '📊 Sonuçlar', value: sonuclar.join('\n') || 'Sonuç yok', inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // ── /TAMYASAKKALDIR ──
  if (cmd === 'tamyasakkaldir') {
    await interaction.deferReply({ ephemeral: false });

    if (!interaction.member.roles.cache.has(process.env.YETKILI_ROL_ID)) {
      return interaction.editReply({ embeds: [errorEmbed('Yetersiz Yetki', 'Bu komutu kullanmak için yetkin yok.')] });
    }

    const kullaniciId = interaction.options.getString('kullanici-id').trim();
    const sunucular = process.env.BAGLI_SUNUCULAR.split(',').map(s => s.trim()).filter(Boolean);

    const sonuclar = [];
    for (const sunucuId of sunucular) {
      try {
        const sunucu = client.guilds.cache.get(sunucuId);
        if (!sunucu) { sonuclar.push(`⚠️ \`${sunucuId}\` — Bot bu sunucuda değil`); continue; }
        await sunucu.members.unban(kullaniciId, `Yapan: ${interaction.user.tag}`);
        sonuclar.push(`✅ **${sunucu.name}** — Ban kaldırıldı`);
      } catch (err) {
        if (err.code === 10026) {
          sonuclar.push(`ℹ️ **${sunucu?.name || sunucuId}** — Zaten banlı değil`);
        } else {
          sonuclar.push(`❌ \`${sunucuId}\` — ${err.message}`);
        }
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('✅ Tam Yasak Kaldırıldı')
      .addFields(
        { name: '👤 Kullanıcı ID', value: kullaniciId, inline: true },
        { name: '🛡️ Yapan', value: `${interaction.user}`, inline: true },
        { name: '📊 Sonuçlar', value: sonuclar.join('\n') || 'Sonuç yok', inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // ── /GRUP-LİSTELE ──
  if (cmd === 'grup-listele') {
    await interaction.deferReply({ ephemeral: false });
    const kullanici = interaction.options.getString('kullanici');

    try {
      const userId = await roblox.getUserId(kullanici);
      if (!userId) {
        return interaction.editReply({ embeds: [errorEmbed('Bulunamadı', `**${kullanici}** adlı Roblox kullanıcısı bulunamadı.`)] });
      }

      const gruplar = await roblox.getUserGroups(userId);
      if (!gruplar || gruplar.length === 0) {
        return interaction.editReply({ embeds: [errorEmbed('Grup Yok', `**${kullanici}** hiçbir gruba üye değil.`)] });
      }

      const avatarUrl = `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;

      // Grupları sayfalara böl (max 25 field)
      const gosterilecek = gruplar.slice(0, 25);
      const grupListesi = gosterilecek.map(g =>
        `**[${g.role.rank}] ${g.role.name}**\n[${g.group.name}](https://www.roblox.com/groups/${g.group.id})`
      ).join('\n\n');

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`👥 ${kullanici} — Grup Listesi`)
        .setThumbnail(avatarUrl)
        .setDescription(grupListesi)
        .setFooter({ text: `Toplam ${gruplar.length} grup${gruplar.length > 25 ? ` (ilk 25 gösteriliyor)` : ''}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('grup-listele hatası:', err.message);
      await interaction.editReply({ embeds: [errorEmbed('Hata', err.message)] });
    }
    return;
  }

  // ── /TICKET PANELİ ──
  if (cmd === 'ticket') {
    if (!interaction.member.roles.cache.has(process.env.TICKET_YETKILI_ROL_ID)) {
      return interaction.reply({ embeds: [errorEmbed('Yetersiz Yetki', 'Sadece yetkililer ticket paneli gönderebilir.')], ephemeral: true });
    }

    const panelEmbed = new EmbedBuilder()
      .setColor(0x2c3e50)
      .setTitle('🎫 Destek Sistemi')
      .setDescription([
        'Aşağıdan ticket kategorini seç ve destek al.',
        '',
        '📦 **Transfer** — Transfer talepleri',
        '🎮 **Oyun İçi Şikayet** — Oyun içi şikayetler',
        '📋 **Diğer** — Diğer konular',
      ].join('\n'))
      .setFooter({ text: 'Gereksiz ticket açmayın.' })
      .setTimestamp();

    const menu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ticket_kategori')
        .setPlaceholder('📂 Kategori seç...')
        .addOptions([
          { label: 'Transfer', description: 'Transfer talepleri için', value: 'transfer', emoji: '📦' },
          { label: 'Oyun İçi Şikayet', description: 'Oyun içi şikayetler için', value: 'sikayet', emoji: '🎮' },
          { label: 'Diğer', description: 'Diğer konular için', value: 'diger', emoji: '📋' },
        ])
    );

    await interaction.reply({ embeds: [panelEmbed], components: [menu] });
    return;
  }

  // ── /AKTİF ──
  if (cmd === 'aktif') {
    await interaction.deferReply({ ephemeral: false });

    // Yetki kontrolü
    if (!interaction.member.roles.cache.has('1505537968276901938')) {
      return interaction.editReply({ embeds: [errorEmbed('Yetersiz Yetki', 'Bu komutu kullanmak için gerekli role sahip değilsin.')] });
    }
    const ekMesaj = interaction.options.getString('mesaj');
    const oyunLinki = 'https://www.roblox.com/tr/games/138943597146402/T-rk-Asker-Oyunu';

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🚨 AKTİFLİK ÇAĞRISI')
      .setDescription([
        '**Sizi oyuna çağırıyor!**',
        '',
        '🎮 Herkes oyuna beyler, aktiflik sağlayalım!',
        ekMesaj ? `\n💬 ${ekMesaj}` : '',
        '',
        `🔗 [Oyuna Katıl](${oyunLinki})`,
      ].filter(Boolean).join('\n'))
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }) ?? null)
      .addFields({ name: '📢 Çağıran', value: `${interaction.user}`, inline: true })
      .setTimestamp();

    await interaction.editReply({ content: '@everyone', embeds: [embed], allowedMentions: { parse: ['everyone'] } });
    return;
  }

  if (!(cmd in commandConfig)) return;

  await interaction.deferReply({ ephemeral: false });
  const cfg = commandConfig[cmd];
  const hedefAdi = interaction.options.getString('kullanici');
  const roleId   = parseInt(interaction.options.getString('rütbe'));
  const sebep    = interaction.options.getString('sebep');

  try {
    // 1. YETKİ KONTROLÜ
    const yetkiliRolId = process.env.YETKILI_ROL_ID;
    if (yetkiliRolId && yetkiliRolId !== 'DISCORD_ROL_ID_BURAYA') {
      if (!interaction.member.roles.cache.has(yetkiliRolId)) {
        return interaction.editReply({ embeds: [errorEmbed('Yetersiz Yetki', 'Bu komutu kullanmak için gerekli Discord rolüne sahip değilsin.')] });
      }
    }

    // 2. KULLANANIN ROBLOX ID'Sİ — RoWifi API ile doğrulanmış hesabı al
    let veren;
    try {
      veren = await getVerifiedRoblox(interaction.guildId, interaction.user.id);
    } catch (err) {
      console.error('rütbe-ver RoWifi hata:', err?.response?.status, JSON.stringify(err?.response?.data), err.message);
      return interaction.editReply({ embeds: [errorEmbed('Hesap Doğrulanmamış', `RoWifi ile Roblox hesabın doğrulanmamış. \`/verify\` komutunu kullan.\n\`${err.message}\``)] });
    }
    const verenId = veren.id;
    const verenAdi = veren.name;

    const verenRank = await roblox.getUserRankInGroup(verenId);
    if (verenRank === 0) {
      return interaction.editReply({ embeds: [errorEmbed('Grupta Değilsin', `**${verenAdi}** grupta üye değil.`)] });
    }

    // 3. RÜTBE KONTROLÜ
    const roles = await roblox.getGroupRoles();
    const targetRole = roles.find(r => r.id === roleId);
    if (!targetRole) {
      return interaction.editReply({ embeds: [errorEmbed('Geçersiz Rütbe', 'Seçilen rütbe bulunamadı.')] });
    }

    if (targetRole.rank >= verenRank) {
      return interaction.editReply({ embeds: [errorEmbed('Yetersiz Rütbe', `Kendi rütbenden (**Rank ${verenRank}**) eşit veya yüksek rütbe veremezsin.\nSeçilen: \`[${targetRole.rank}] ${targetRole.name}\``)] });
    }

    // 4. HEDEF KULLANICI
    const hedefId = await roblox.getUserId(hedefAdi);
    if (!hedefId) {
      return interaction.editReply({ embeds: [errorEmbed('Hedef Bulunamadı', `**${hedefAdi}** adlı Roblox kullanıcısı bulunamadı.`)] });
    }

    // Kendine rütbe veremesin
    if (hedefId === verenId) {
      return interaction.editReply({ embeds: [errorEmbed('Geçersiz İşlem', 'Kendine rütbe veremezsin.')] });
    }
    const hedefRank = await roblox.getUserRankInGroup(hedefId);
    if (hedefRank === 0) {
      return interaction.editReply({ embeds: [errorEmbed('Hedef Grupta Değil', `**${hedefAdi}** grupta üye değil.`)] });
    }

    // 5. RÜTBE DEĞİŞTİR
    await roblox.setRank(hedefId, roleId);

    const avatarUrl = `https://www.roblox.com/headshot-thumbnail/image?userId=${hedefId}&width=420&height=420&format=png`;

    const successEmbed = new EmbedBuilder()
      .setColor(cfg.color)
      .setAuthor({ name: `${cfg.emoji} ${cfg.baslik}`, iconURL: interaction.guild.iconURL({ dynamic: true }) ?? undefined })
      .setThumbnail(avatarUrl)
      .addFields(
        { name: '👤 Hedef Kullanıcı', value: `[${hedefAdi}](https://www.roblox.com/users/${hedefId}/profile)`, inline: true },
        { name: '🏅 Verilen Rütbe', value: `\`[${targetRole.rank}] ${targetRole.name}\``, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '📝 Sebep', value: sebep, inline: false },
        { name: '🛡️ İşlemi Yapan', value: `${interaction.user} (${verenAdi})`, inline: true },
        { name: '🕐 Tarih', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
      )
      .setFooter({ text: `Roblox ID: ${hedefId}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });

    const logChannel = client.channels.cache.get(process.env.LOG_CHANNEL_ID);
    if (logChannel && logChannel.id !== interaction.channelId) {
      const logEmbed = new EmbedBuilder()
        .setColor(cfg.color)
        .setTitle(`📋 ${cfg.baslik} Logu`)
        .setThumbnail(avatarUrl)
        .addFields(
          { name: '👤 Hedef', value: `[${hedefAdi}](https://www.roblox.com/users/${hedefId}/profile)`, inline: true },
          { name: '🏅 Rütbe', value: `\`[${targetRole.rank}] ${targetRole.name}\``, inline: true },
          { name: '📝 Sebep', value: sebep },
          { name: '🛡️ İşlemi Yapan', value: `${interaction.user} | ${verenAdi}`, inline: true },
          { name: '📍 Kanal', value: `${interaction.channel}`, inline: true }
        )
        .setFooter({ text: `Hedef Roblox ID: ${hedefId}` })
        .setTimestamp();
      await logChannel.send({ embeds: [logEmbed] });
    }

  } catch (err) {
    console.error(`${cmd} hatası:`, err.message);
    await interaction.editReply({ embeds: [errorEmbed('Bir Hata Oluştu', `\`\`\`${err.message}\`\`\``)] });
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (message.content.toLowerCase() === '!grup') {
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🎮 | TMS | Turkish Military Simulatör')
      .setDescription('Grubumuzа katılmak için aşağıdaki linke tıkla!')
      .addFields(
        { name: '🔗 Grup Linki', value: '[Gruba Katıl](https://www.roblox.com/groups/493884664)' },
        { name: '🎮 Oyun Linki', value: '[Oyunu Oyna](https://www.roblox.com/tr/games/138943597146402/T-rk-Asker-Oyunu)' }
      )
      .setTimestamp();
    await message.reply({ embeds: [embed] });
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ HATA: DISCORD_TOKEN bulunamadı!");
  console.error("Eğer botu Railway, Render veya benzeri bir sunucuda çalıştırıyorsanız, panelden Environment Variables (Ortam Değişkenleri) kısmına DISCORD_TOKEN eklemeniz gerekir.");
  console.error(".env dosyası .gitignore'da olduğu için sunucuya yüklenmez.");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);

// ── EXPRESS HTTP SUNUCUSU ──
const express = require('express');
const app = express();
app.use(express.json());

const ROBLOX_SECRET = process.env.ROBLOX_SECRET || 'tms-secret-key';

// Komut kuyruğu — Roblox script buradan poll eder
const commandQueue = [];

// ── OYUN → DISCORD LOG ──
// Adonis komut logları buraya gelir
app.post('/log', (req, res) => {
  const { secret, komut, yapan, hedef, oyunAdi, serverId } = req.body;

  if (secret !== ROBLOX_SECRET) {
    return res.status(401).json({ error: 'Yetkisiz' });
  }

  const komutEmojileri = {
    ban: '🔨', globalban: '🌐🔨', kick: '👢',
    fly: '✈️', shutdown: '🔴'
  };

  const emoji = komutEmojileri[komut?.toLowerCase()] || '⚙️';

  const logKanal = client.channels.cache.get(process.env.LOG_CHANNEL_ID);
  if (logKanal) {
    const embed = new EmbedBuilder()
      .setColor(komut?.toLowerCase() === 'shutdown' ? 0xe74c3c : 0xf39c12)
      .setTitle(`${emoji} Oyun İçi Komut — ${komut?.toUpperCase()}`)
      .addFields(
        { name: '🎮 Oyun', value: oyunAdi || 'Bilinmiyor', inline: true },
        { name: '🖥️ Sunucu', value: serverId ? `\`${serverId}\`` : 'Bilinmiyor', inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '🛡️ Yapan', value: yapan || 'Bilinmiyor', inline: true },
        { name: '👤 Hedef', value: hedef || '—', inline: true },
        { name: '🕐 Tarih', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
      )
      .setTimestamp();
    logKanal.send({ embeds: [embed] }).catch(console.error);
  }

  res.json({ ok: true });
});

// ── DISCORD → OYUN komut kuyruğu ──
// Roblox script bu endpoint'i poll eder
app.get('/commands', (req, res) => {
  const { secret } = req.query;
  if (secret !== ROBLOX_SECRET) {
    return res.status(401).json({ error: 'Yetkisiz' });
  }
  const cmds = commandQueue.splice(0, commandQueue.length);
  res.json({ commands: cmds });
});

// Sunucuyu başlat
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ HTTP sunucusu başlatıldı: port ${PORT}`);
});

// commandQueue'yu diğer modüllerde kullanmak için export et
module.exports = { commandQueue };
