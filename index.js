require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const roblox = require('./roblox');
const fs = require('fs');

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

client.once('ready', async () => {
  console.log(`✅ Discord botu hazır: ${client.user.tag}`);
  await loginRoblox();
});

const commandConfig = {
  'rütbe-ver':  { color: 0x2ecc71, emoji: '🏅', baslik: 'Rütbe Verildi'  },
  'terfi-ver':  { color: 0xf1c40f, emoji: '⬆️', baslik: 'Terfi Edildi'   },
  'tenzil-ver': { color: 0xe74c3c, emoji: '⬇️', baslik: 'Tenzil Edildi'  },
};

const errorEmbed = (title, desc) =>
  new EmbedBuilder().setColor(0xff4757).setTitle(`❌ ${title}`).setDescription(desc).setTimestamp();

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

  // ── /TAMYASAKLA ──
  if (cmd === 'tamyasakla') {
    await interaction.deferReply({ ephemeral: false });

    // Sadece yetkililer kullanabilir
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
        if (!sunucu) {
          sonuclar.push(`⚠️ \`${sunucuId}\` — Bot bu sunucuda değil`);
          continue;
        }
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
    const ekMesaj = interaction.options.getString('mesaj');
    const oyunLinki = 'https://www.roblox.com/share?code=39585213feb70c49aefd80ba66c143ff&type=ExperienceDetails&stamp=1778906888366';

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

    // 2. KULLANANIN ROBLOX ADI — nickname'den al
    const verenAdi = interaction.member.nickname || interaction.user.username;
    const verenId = await roblox.getUserId(verenAdi);
    if (!verenId) {
      return interaction.editReply({ embeds: [errorEmbed('Roblox Hesabı Bulunamadı', `Discord nickname'in (**${verenAdi}**) Roblox'ta bulunamadı. RoWifi ile doğrula.`)] });
    }

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

client.login(process.env.DISCORD_TOKEN);
