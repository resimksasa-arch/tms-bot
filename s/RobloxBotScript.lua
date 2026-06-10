-- TMS Bot Entegrasyon Scripti
-- Roblox Studio'da ServerScriptService içine koy

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")

local BOT_URL = "https://tmsbot-production.up.railway.app"
local SECRET = "tms-secret-key" -- Railway'deki ROBLOX_SECRET ile aynı olmalı
local POLL_INTERVAL = 5 -- Kaç saniyede bir komut kontrol edilsin

-- Adonis'e erişim (Adonis yüklüyse)
local Adonis = nil
pcall(function()
	Adonis = require(game.ServerScriptService.Adonis.MainModule)
end)

-- ── OYUN → DISCORD LOG ──
local function logToDiscord(komut, yapan, hedef)
	local ok, err = pcall(function()
		HttpService:PostAsync(
			BOT_URL .. "/log",
			HttpService:JSONEncode({
				secret = SECRET,
				komut = komut,
				yapan = yapan or "Bilinmiyor",
				hedef = hedef or "",
				oyunAdi = game.Name,
				serverId = tostring(game.JobId)
			}),
			Enum.HttpContentType.ApplicationJson
		)
	end)
	if not ok then
		warn("[TMSBot] Log gönderilemedi: " .. tostring(err))
	end
end

-- Adonis komut hookları
-- Adonis'in komut sistemi üzerinden log atıyoruz
local function hookAdonisCommands()
	if not Adonis then
		warn("[TMSBot] Adonis bulunamadı, komut hook'ları atlandı.")
		return
	end

	-- Adonis event sistemi varsa kullan
	pcall(function()
		local adonisEvents = Adonis.Server.Events
		if adonisEvents and adonisEvents.CommandRan then
			adonisEvents.CommandRan:Connect(function(data)
				local komutAdi = data.Command and data.Command.Name or "bilinmiyor"
				local izlenenKomutlar = { ban = true, globalban = true, kick = true, fly = true, shutdown = true }
				if izlenenKomutlar[string.lower(komutAdi)] then
					logToDiscord(
						komutAdi,
						data.Caller and data.Caller.Name or "Bilinmiyor",
						data.Args and data.Args[1] or ""
					)
				end
			end)
			print("[TMSBot] Adonis komut hookları bağlandı.")
		end
	end)
end

-- ── DISCORD → OYUN komut kuyruğu ──
local function executeCommand(komutData)
	local komut = string.lower(komutData.komut or "")
	local hedef = komutData.hedef
	local sebep = komutData.sebep or "Discord komutu"

	print("[TMSBot] Komut alındı: " .. komut .. " | Hedef: " .. tostring(hedef))

	if komut == "ban" then
		local oyuncu = Players:FindFirstChild(hedef)
		if oyuncu then
			oyuncu:Kick("🔨 Banlandın | Sebep: " .. sebep)
			logToDiscord("ban", "Discord Bot", hedef)
		else
			warn("[TMSBot] Ban: oyuncu bulunamadı: " .. tostring(hedef))
		end

	elseif komut == "kick" then
		local oyuncu = Players:FindFirstChild(hedef)
		if oyuncu then
			oyuncu:Kick("👢 Atıldın | Sebep: " .. sebep)
			logToDiscord("kick", "Discord Bot", hedef)
		else
			warn("[TMSBot] Kick: oyuncu bulunamadı: " .. tostring(hedef))
		end

	elseif komut == "globalban" then
		-- Adonis global ban
		if Adonis then
			pcall(function()
				Adonis.Server.Functions.AddBan({
					Name = hedef,
					Reason = sebep
				})
			end)
		end
		local oyuncu = Players:FindFirstChild(hedef)
		if oyuncu then
			oyuncu:Kick("🌐🔨 Global Banlandın | Sebep: " .. sebep)
		end
		logToDiscord("globalban", "Discord Bot", hedef)

	elseif komut == "fly" then
		local oyuncu = Players:FindFirstChild(hedef)
		if oyuncu and oyuncu.Character then
			-- Uçuş için BodyVelocity ekle
			local hrp = oyuncu.Character:FindFirstChild("HumanoidRootPart")
			if hrp then
				local bg = Instance.new("BodyGyro", hrp)
				bg.MaxTorque = Vector3.new(0, 0, 0)
				local bv = Instance.new("BodyVelocity", hrp)
				bv.Velocity = Vector3.new(0, 50, 0)
				bv.MaxForce = Vector3.new(0, 4000, 0)
				game:GetService("Debris"):AddItem(bv, 3)
				game:GetService("Debris"):AddItem(bg, 3)
				logToDiscord("fly", "Discord Bot", hedef)
			end
		else
			warn("[TMSBot] Fly: oyuncu bulunamadı: " .. tostring(hedef))
		end

	elseif komut == "shutdown" then
		logToDiscord("shutdown", "Discord Bot", "Tüm oyuncular")
		-- Tüm oyuncuları at
		for _, oyuncu in pairs(Players:GetPlayers()) do
			oyuncu:Kick("🔴 Sunucu kapatıldı | Sebep: " .. sebep)
		end
	end
end

-- Poll döngüsü — botu periyodik olarak kontrol et
local function startPolling()
	while true do
		task.wait(POLL_INTERVAL)
		local ok, result = pcall(function()
			local response = HttpService:GetAsync(
				BOT_URL .. "/commands?secret=" .. SECRET,
				true
			)
			return HttpService:JSONDecode(response)
		end)

		if ok and result and result.commands then
			for _, komutData in ipairs(result.commands) do
				pcall(executeCommand, komutData)
			end
		elseif not ok then
			warn("[TMSBot] Poll hatası: " .. tostring(result))
		end
	end
end

-- Başlat
print("[TMSBot] Başlatılıyor...")
hookAdonisCommands()
task.spawn(startPolling)
print("[TMSBot] Hazır! Poll interval: " .. POLL_INTERVAL .. "s")
