# FHD Verkaufskalkulation - Deployment Anleitung

## Voraussetzungen auf dem Windows PC

1. **Node.js** (Version 18 oder höher) installieren
   - Download: https://nodejs.org/

2. **Git** (optional, für Updates)
   - Download: https://git-scm.com/

## Installation

### 1. Projekt auf den PC kopieren

Kopiere den gesamten `fhd_calc_tool` Ordner auf den Windows PC (z.B. nach `C:\fhd_calc_tool`).

### 2. Dependencies installieren

```cmd
cd C:\fhd_calc_tool\server
npm install

cd C:\fhd_calc_tool\client
npm install
```

### 3. Client Build erstellen

```cmd
cd C:\fhd_calc_tool\client
npm run build
```

Dies erstellt einen optimierten Production-Build im `client/dist` Ordner.

## Server starten

### Option 1: Manuell starten

```cmd
cd C:\fhd_calc_tool\server
npm start
```

Der Server läuft dann auf Port 5001.

### Option 2: Als Windows Service (empfohlen für Dauerbetrieb)

1. Installiere `node-windows`:
```cmd
cd C:\fhd_calc_tool\server
npm install -g node-windows
```

2. Erstelle Service-Skript (siehe unten)

### Option 3: Mit PM2 (Alternative)

```cmd
npm install -g pm2-windows-startup
pm2-startup install

cd C:\fhd_calc_tool\server
pm2 start src/server.js --name fhd-calc-tool
pm2 save
```

## Zugriff von anderen PCs im Netzwerk

### 1. IP-Adresse des Windows PCs herausfinden

```cmd
ipconfig
```

Suche nach der IPv4-Adresse (z.B. `192.168.1.100`)

### 2. Windows Firewall konfigurieren

**Methode A: Regel in der Firewall erstellen**
1. Windows Defender Firewall öffnen
2. "Erweiterte Einstellungen" → "Eingehende Regeln" → "Neue Regel"
3. Regeltyp: "Port" auswählen
4. TCP, Spezifischer Port: `5001`
5. "Verbindung zulassen" aktivieren
6. Profile: Alle auswählen (Domäne, Privat, Öffentlich)
7. Name: "FHD Calc Tool"
8. Fertigstellen

**Methode B: PowerShell (als Administrator)**
```powershell
New-NetFirewallRule -DisplayName "FHD Calc Tool" -Direction Inbound -Protocol TCP -LocalPort 5001 -Action Allow
```

### 3. Von anderen PCs zugreifen

Öffne im Browser auf einem anderen PC:
```
http://192.168.1.100:5001
```
(Ersetze `192.168.1.100` mit der tatsächlichen IP des Servers)

## Konfiguration

### Port ändern

Erstelle eine `.env` Datei in `server/`:

```env
PORT=5001
NODE_ENV=production
```

### Login-Passwort ändern

Das Passwort ist in `server/src/routes/auth.js` hardcodiert:
```javascript
const correctPassword = 'BigBrother2025!';
```

## Automatischer Start bei Windows-Boot

### Variante 1: Task Scheduler

1. Task Scheduler öffnen
2. "Einfache Aufgabe erstellen"
3. Name: "FHD Calc Tool"
4. Trigger: "Beim Starten des Computers"
5. Aktion: "Programm starten"
6. Programm: `C:\Program Files\nodejs\node.exe`
7. Argumente: `C:\fhd_calc_tool\server\src\server.js`
8. Startverzeichnis: `C:\fhd_calc_tool\server`

### Variante 2: Startup Ordner

Erstelle eine `.bat` Datei `start-fhd-calc.bat`:

```batch
@echo off
cd C:\fhd_calc_tool\server
start /B node src/server.js
```

Kopiere diese Datei in:
```
C:\Users\[USERNAME]\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup
```

## Backup der Daten

Die Datenbank liegt in:
```
C:\fhd_calc_tool\server\data\database.json
```

Sichere diese Datei regelmäßig!

## Troubleshooting

### Server startet nicht
- Prüfe ob Port 5001 bereits belegt ist: `netstat -ano | findstr :5001`
- Prüfe Node.js Version: `node --version` (sollte >= 18 sein)

### Kein Zugriff von anderen PCs
- Ping den Server: `ping 192.168.1.100`
- Prüfe Firewall-Regel: `netsh advfirewall firewall show rule name="FHD Calc Tool"`
- Stelle sicher, dass beide PCs im gleichen Netzwerk sind

### Daten gehen verloren
- Überprüfe ob `server/data/database.json` existiert
- Stelle sicher dass der Server Schreibrechte auf das Verzeichnis hat

## Updates

Um die Anwendung zu aktualisieren:

1. Stoppe den Server
2. Ersetze die Dateien im `fhd_calc_tool` Ordner
3. Führe im `client` Ordner aus: `npm run build`
4. Starte den Server neu

Die Datenbank (`server/data/database.json`) bleibt erhalten!
