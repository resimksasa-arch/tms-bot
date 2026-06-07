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
