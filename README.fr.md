<p align="center">
  <img src="./notebooklm_mcp_logo.png" width="200" alt="Logo Notebook-mcp-server">
</p>

<h1 align="center">Serveur MCP NotebookLM</h1>

<p align="center">
  <b>Laissez vos agents IA discuter directement avec Google NotebookLM pour des réponses sans hallucination.</b>
</p>

<p align="center">
  <a href="README.md">English</a> • 
  <a href="README.es.md">Español</a> • 
  <b>Français</b> • 
  <a href="README.pt.md">Português</a> • 
  <a href="README.de.md">Deutsch</a>
</p>

<p align="center">
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-Model%20Context%20Protocol-orange?style=for-the-badge" alt="MCP"></a>
  <a href="https://www.npmjs.com/package/notebooklm-mcp-server"><img src="https://img.shields.io/badge/NPM-CB3837?style=for-the-badge&logo=npm&logoColor=white" alt="NPM"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Windows-0078D4?style=for-the-badge&logo=windows&logoColor=white" alt="Windows">
  <img src="https://img.shields.io/badge/macOS-000000?style=for-the-badge&logo=apple&logoColor=white" alt="macOS">
  <img src="https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Linux">
</p>

<p align="center">
  <a href="https://anthropic.com"><img src="https://img.shields.io/badge/Claude%20Code-Skill-blueviolet?style=for-the-badge" alt="Claude Code"></a>
  <a href="https://geminicli.com/"><img src="https://img.shields.io/badge/Gemini%20CLI-Skill-blueviolet?style=for-the-badge" alt="Gemini CLI"></a>
  <img src="https://img.shields.io/badge/Cursor-000000?style=for-the-badge&logo=cursor&logoColor=white" alt="Cursor">
  <img src="https://img.shields.io/badge/Windsurf-00AEEF?style=for-the-badge" alt="Windsurf">
  <img src="https://img.shields.io/badge/Cline-FF5733?style=for-the-badge" alt="Cline">
</p>

<p align="center">
  <a href="#installation">Installation</a> • 
  <a href="#authentification">Authentification</a> • 
  <a href="#démarrage-rapide-claude-desktop">Démarrage Rapide</a> • 
  <a href="#compétence-claude-code">Claude Code</a> • 
  <a href="#documentation">Documentation</a> •
  <a href="#développement">Développement</a>
</p>

## La Solution

Le **Serveur MCP NotebookLM** apporte la puissance de Google NotebookLM directement dans votre flux de travail augmenté par l'IA. Construit nativement en **TypeScript** via le Model Context Protocol, il permet aux agents de lire, rechercher et gérer vos carnets de notes comme s'il s'agissait de fichiers locaux.

---

## 🚀 Installation

### 1. Installation Globale (Recommandée)

Vous pouvez installer le serveur directement depuis NPM :

```bash
npm install -g notebooklm-mcp-server
```

> [!NOTE]
> **Mise à jour automatique** : Le serveur vérifie automatiquement les nouvelles versions au démarrage. Si une mise à jour existe, elle s'installera d'elle-même et vous demandera de redémarrer pour garantir que vous disposez toujours des derniers correctifs Google.

### 2. Utilisation directe avec NPX (Zéro-Config)

Si vous ne souhaitez pas l'installer globalement, vous pouvez l'exécuter directement :

```bash
npx notebooklm-mcp-server auth   # Pour se connecter
npx notebooklm-mcp-server start  # Pour lancer le serveur
```

---

## 🔑 Authentification

Avant d'utiliser le serveur, vous devez le lier à votre compte Google. Cette version utilise une session de navigateur sécurisée et persistante :

1. Lancez la commande d'authentification :
   ```bash
   npx notebooklm-mcp-server auth
   ```
2. Une fenêtre de navigateur s'ouvrira. Connectez-vous avec votre compte Google.
3. Fermez le navigateur une fois que vous voyez vos carnets de notes. Votre session est maintenant enregistrée localement en toute sécurité.

> [!TIP]
> **Session expirée ?** Si votre agent reçoit des erreurs d'authentification, demandez-lui simplement d'exécuter la commande `npx notebooklm-mcp-server refresh_auth`. Cela ouvrira automatiquement le navigateur pour que vous puissiez renouveler la session sans quitter votre chat.

---

## ⚡ Démarrage Rapide

### 🤖 Claude Desktop

Ajoutez ce qui suit à votre fichier `claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "npx",
      "args": ["-y", "notebooklm-mcp-server", "start"]
    }
  }
}
```

### 💻 Visual Studio Code

Comme VS Code ne supporte pas encore nativement le MCP, vous devez utiliser une extension :

#### Option A : Utiliser [Cline](https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev) (Recommandé)

1. Ouvrez les **Paramètres de Cline** dans VS Code.
2. Faites défiler jusqu'à la section **MCP Servers**.
3. Cliquez sur **Add New MCP Server**.
4. Utilisez la configuration suivante :
   - **Nom** : `notebooklm`
   - **Commande** : `npx -y notebooklm-mcp-server start`

#### Option B : Utiliser [MCP Client](https://marketplace.visualstudio.com/items?itemName=stefan-mcp.mcp-client)

1. Installez l'extension depuis le Marketplace.
2. Ouvrez votre `settings.json` VS Code.
3. Ajoutez le serveur sous `mcp.servers` :
   ```json
   "mcp.servers": {
     "notebooklm": {
       "command": "npx",
       "args": ["-y", "notebooklm-mcp-server", "start"]
     }
   }
   ```

### 🌌 Antigravity

Antigravity supporte nativement le MCP. Vous pouvez ajouter le serveur en éditant votre fichier de configuration globale :

1. **Localisez votre `mcp.json`** :
   - **Windows** : `%APPDATA%\antigravity\mcp.json`
   - **macOS** : `~/Library/Application Support/antigravity/mcp.json`
   - **Linux** : `~/.config/antigravity/mcp.json`

2. **Ajoutez le serveur** à l'objet `mcpServers` :

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "npx",
      "args": ["-y", "notebooklm-mcp-server", "start"]
    }
  }
}
```

3. **Redémarrez Antigravity** : Les nouveaux outils apparaîtront instantanément dans votre barre latérale.

---

### 💎 Gemini CLI

Exécutez la commande suivante dans votre terminal pour ajouter la compétence notebooklm :

```bash
gemini mcp add notebooklm --scope user -- npx -y notebooklm-mcp-server start
```

---

## 🤖 Compétence Claude Code

Ajoutez-la instantanément à Claude Code :

```bash
claude skill add notebooklm -- "npx -y notebooklm-mcp-server start"
```

---

## 📖 Documentation

Les outils suivants sont disponibles via ce serveur MCP :

### 📒 Gestion des Carnets de Notes
| Outil               | Description                                           |
| :------------------ | :---------------------------------------------------- |
| `notebook_list`     | Liste tous les carnets de notes de votre compte.      |
| `notebook_create`   | Crée un nouveau carnet avec un titre.                 |
| `notebook_rename`   | Renomme un carnet existant.                           |
| `notebook_delete`   | Supprime un carnet (Attention : Destructif).          |

### 🖇️ Gestion des Sources
| Outil                    | Description                                              |
| :----------------------- | :------------------------------------------------------- |
| `notebook_add_url`       | Ajoute un site Web ou une vidéo YouTube comme source.    |
| `notebook_add_text`      | Ajoute un contenu textuel personnalisé comme source.     |
| `notebook_add_local_file`| Télécharge un fichier local PDF, Markdown ou Texte.      |
| `notebook_add_drive`     | Ajoute un fichier Google Drive (Docs, Slides, etc.).     |
| `source_delete`          | Supprime una source d'un carnet.                         |
| `source_sync`            | Synchronise une source Drive pour obtenir la version la plus récente. |

### 🔍 Recherche & Requêtes
| Outil               | Description                                           |
| :------------------ | :---------------------------------------------------- |
| `notebook_query`    | Pose une question basée sur les sources à un carnet spécifique. |
| `research_start`    | Démarre une tâche de recherche Web/Drive.             |
| `research_poll`     | Interroge l'état et les résultats de la recherche.    |
| `research_import`   | Importe les résultats de recherche comme sources permanentes. |

### 🎨 Studio & Génération
| Outil                    | Description                                           |
| :----------------------- | :---------------------------------------------------- |
| `audio_overview_create`  | Génère un aperçu audio (podcast).                     |
| `studio_poll`            | Vérifie l'état des artefacts audio/vidéo générés.     |
| `mind_map_generate`      | Génère un JSON de carte mentale à partir des sources. |

### ⚙️ Système
| Outil           | Description                                                        |
| :-------------- | :----------------------------------------------------------------- |
| `refresh_auth`  | **Interactif** : Ouvre un navigateur pour renouveler votre session Google. À utiliser si les outils commencent à échouer. |

---

## 🛠️ Développement

Pour contribuer ou compiler à partir des sources :

```bash
git clone https://github.com/moodRobotics/notebook-mcp-server.git
npm install
npm run build
```

## 📄 Licence

Licence MIT. Développé avec ❤️ par [moodRobotics](https://github.com/moodRobotics).
