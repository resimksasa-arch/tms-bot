require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

function buildRankCommand(name, description, rutbeDesc) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addStringOption(o =>
      o.setName('kullanici')
       .setDescription('Rütbe verilecek Roblox kullanıcı adı')
       .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('rütbe')
       .setDescription(rutbeDesc)
       .setRequired(true)
       .setAutocomplete(true)
    )
    .addStringOption(o =>
      o.setName('sebep')
       .setDescription('Sebep')
       .setRequired(true)
    );
}

const commands = [
  buildRankCommand('rütbe-ver',  'Roblox grubunda bir kullanıcıya rütbe ver', 'Verilecek rütbeyi seç'),
  buildRankCommand('terfi-ver',  'Roblox grubunda bir kullanıcıyı terfi et',  'Terfi edilecek rütbeyi seç'),
  buildRankCommand('tenzil-ver', 'Roblox grubunda bir kullanıcıyı tenzil et', 'Tenzil edilecek rütbeyi seç'),

  new SlashCommandBuilder()
    .setName('aktif')
    .setDescription('Herkesi oyuna çağır')
    .addStringOption(o =>
      o.setName('mesaj')
       .setDescription('Ek mesaj (isteğe bağlı)')
       .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket panelini gönder (sadece yetkililer)'),

  new SlashCommandBuilder()
    .setName('grup-listele')
    .setDescription('Bir Roblox kullanıcısının gruplarını göster')
    .addStringOption(o =>
      o.setName('kullanici')
       .setDescription('Roblox kullanıcı adı')
       .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('tamyasakla')
    .setDescription('Kullanıcıyı tüm bağlı sunuculardan banla')
    .addUserOption(o =>
      o.setName('kullanici')
       .setDescription('Banlanacak Discord kullanıcısı')
       .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('sebep')
       .setDescription('Ban sebebi')
       .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('oyun-ban')
    .setDescription('Oyunda bir oyuncuyu banla')
    .addStringOption(o => o.setName('kullanici').setDescription('Roblox kullanıcı adı').setRequired(true))
    .addStringOption(o => o.setName('sebep').setDescription('Sebep').setRequired(true)),

  new SlashCommandBuilder()
    .setName('oyun-globalban')
    .setDescription('Oyunda bir oyuncuyu global banla')
    .addStringOption(o => o.setName('kullanici').setDescription('Roblox kullanıcı adı').setRequired(true))
    .addStringOption(o => o.setName('sebep').setDescription('Sebep').setRequired(true)),

  new SlashCommandBuilder()
    .setName('oyun-kick')
    .setDescription('Oyunda bir oyuncuyu at')
    .addStringOption(o => o.setName('kullanici').setDescription('Roblox kullanıcı adı').setRequired(true))
    .addStringOption(o => o.setName('sebep').setDescription('Sebep').setRequired(true)),

  new SlashCommandBuilder()
    .setName('oyun-fly')
    .setDescription('Oyunda bir oyuncuya fly ver')
    .addStringOption(o => o.setName('kullanici').setDescription('Roblox kullanıcı adı').setRequired(true)),

  new SlashCommandBuilder()
    .setName('oyun-shutdown')
    .setDescription('Oyun sunucusunu kapat')
    .addStringOption(o => o.setName('sebep').setDescription('Sebep').setRequired(false)),

  new SlashCommandBuilder()
    .setName('branş-rütbe-ver')
    .setDescription('Bir kullanıcıya branş grubunda rütbe ver')
    .addStringOption(o =>
      o.setName('kullanici')
       .setDescription('Rütbe verilecek Roblox kullanıcı adı')
       .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('branş')
       .setDescription('Hangi branş grubu')
       .setRequired(true)
       .addChoices(
         { name: 'JGK',   value: '511181149' },
         { name: 'Hava',  value: '627383677' },
         { name: 'AS.İZ', value: '858980946' },
         { name: 'SM',    value: '528755654' },
         { name: 'ÖKK',   value: '677805553' },
         { name: 'KK',    value: '804959765' },
       )
    )
    .addStringOption(o =>
      o.setName('rütbe')
       .setDescription('Verilecek rütbeyi seç')
       .setRequired(true)
       .setAutocomplete(true)
    )
    .addStringOption(o =>
      o.setName('sebep')
       .setDescription('Sebep')
       .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('branş-istek')
    .setDescription('Bir kullanıcının branş grubu katılım isteğini kabul et veya reddet')
    .addStringOption(o =>
      o.setName('kullanici')
       .setDescription('Kabul edilecek Roblox kullanıcı adı')
       .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('branş')
       .setDescription('Hangi branş grubuna katılım isteği')
       .setRequired(true)
       .addChoices(
         { name: 'JGK',   value: '511181149' },
         { name: 'Hava',  value: '627383677' },
         { name: 'AS.İZ', value: '858980946' },
         { name: 'SM',    value: '528755654' },
         { name: 'ÖKK',   value: '677805553' },
         { name: 'KK',    value: '804959765' },
       )
    )
    .addStringOption(o =>
      o.setName('sebep')
       .setDescription('Sebep')
       .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('branş-at')
    .setDescription('Bir kullanıcıyı belirtilen branş grubundan at')
    .addStringOption(o =>
      o.setName('kullanici')
       .setDescription('Roblox kullanıcı adı')
       .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('branş')
       .setDescription('Hangi branş grubundan atılacak')
       .setRequired(true)
       .addChoices(
         { name: 'JGK',   value: '511181149' },
         { name: 'Hava',  value: '627383677' },
         { name: 'AS.İZ', value: '858980946' },
         { name: 'SM',    value: '528755654' },
         { name: 'ÖKK',   value: '677805553' },
         { name: 'KK',    value: '804959765' },
       )
    )
    .addStringOption(o =>
      o.setName('sebep')
       .setDescription('Atılma sebebi')
       .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('grup')
    .setDescription('TMS grup ve oyun linklerini göster'),

  new SlashCommandBuilder()
    .setName('tamyasakkaldir')
    .setDescription('Kullanıcının tüm bağlı sunuculardaki banını kaldır')
    .addStringOption(o =>
      o.setName('kullanici-id')
       .setDescription('Banı kaldırılacak kullanıcının Discord ID\'si')
       .setRequired(true)
    ),

].map(cmd => cmd.toJSON());

// Global komutlar (bot profilinde slash simgesi görünmesi için)
const globalCommands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Botun gecikmesini göster'),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Sunucu slash komutları kaydediliyor...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('Sunucu komutları başarıyla kaydedildi!');

    console.log('Global slash komutları kaydediliyor (ping)...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: globalCommands }
    );
    console.log('Global komutlar başarıyla kaydedildi! (Yayılması ~1 saat sürebilir)');
  } catch (error) {
    console.error('Hata:', error);
  }
})();
