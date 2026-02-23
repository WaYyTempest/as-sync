# Guide développeur — AS Sync

Si vous êtes ici, c'est que vous souhaitez comprendre comment le projet fonctionne, corriger un bug ou ajouter une fonctionnalité. Ce document couvre tout ce qu'il faut savoir.

## Organisation du projet

```
entrypoints/
├── popup/              ← le panneau qui s'affiche au clic sur l'icône
│   ├── index.html
│   ├── main.ts
│   └── styles/global.css
├── import/             ← la page qui s'ouvre dans un onglet pour importer
│   ├── index.html
│   ├── main.ts
│   └── styles.css
├── background.ts       ← le routeur de messages (tourne en arrière-plan)
├── content.ts          ← le pont entre l'extension et la page web
└── injected.ts         ← le seul script qui accède au localStorage

utils/
├── json-handler.ts     ← export/import de fichiers JSON
├── storage-parser.ts   ← transforme le localStorage brut en données structurées
└── types.ts            ← les types TypeScript
```

## Communication entre les composants

C'est le point le plus important à comprendre. L'extension ne peut pas accéder directement au localStorage d'un site — il faut passer par plusieurs couches.

### Export (lecture du localStorage)

```
Popup  →  Background  →  Content Script  →  Injected Script  →  localStorage
  ↑           ↑               ↑                    |
  |           |               |                    ↓
  ←───────────←───────────────←──────────── données renvoyées
```

En détail :

1. Le **popup** demande les données : `sendMessage({ type: 'GET_ALL_STORAGE' })`
2. Le **background** reçoit le message et le transmet au content script de l'onglet actif
3. Le **content script** envoie un `postMessage({ type: 'AS_SYNC_GET' })` à la page
4. Le **script injecté** lit tout le localStorage et renvoie les données via `postMessage`
5. Les données remontent dans l'autre sens jusqu'au popup

### Import (écriture dans le localStorage)

```
Page d'import  →  Content Script  →  Injected Script  →  localStorage.setItem()
      ↑                ↑                    |
      |                |                    ↓
      ←────────────────←──────────── { success: true, written: 42 }
```

La différence : la page d'import envoie directement au content script via `browser.tabs.sendMessage(tabId, ...)`. Elle ne passe pas par le background car c'est un onglet, et le background rejette les messages provenant d'onglets web par sécurité.

L'ID de l'onglet cible est transmis dans l'URL : `/import.html?tabId=3&target=anime-sama.tv`

## Détail des fichiers

### `background.ts` — Le routeur

Il écoute les messages du popup, les transmet au bon onglet, et renvoie la réponse. Il vérifie que le message provient bien du popup (pas d'un site web) en contrôlant `sender.tab` — si c'est un onglet web, il refuse.

### `content.ts` — Le pont

Il fait le lien entre le monde de l'extension et celui de la page web. Il utilise `postAndWait()` qui envoie un `window.postMessage` et attend la réponse avec un timeout de 5 secondes.

**Note Firefox MV2** : la fonction `injectScript()` de WXT ne résout jamais sa Promise sur Firefox MV2 (les scripts inline ne déclenchent pas d'événement `load`). Le contournement se trouve dans `content.ts` avec un `Promise.race` et un timeout de 100ms. Le script s'exécute correctement, c'est uniquement la Promise qui reste en attente.

### `injected.ts` — L'accès au localStorage

C'est le seul fichier qui tourne dans le contexte de la page (pas celui de l'extension). Il écoute les `postMessage` et effectue les `localStorage.getItem()` / `localStorage.setItem()`. Deux actions possibles :

- `AS_SYNC_GET` → lit tout le localStorage et renvoie `AS_SYNC_DATA`
- `AS_SYNC_SET` → écrit chaque clé/valeur et renvoie `AS_SYNC_SET_DONE`

### `popup/main.ts` — L'interface popup

Affiche le résumé de progression au clic sur l'icône. Le bouton Export télécharge un fichier JSON. Le bouton Import ouvre la page d'import dans un nouvel onglet (car Firefox ferme le popup à l'ouverture d'un sélecteur de fichier).

### `import/main.ts` — La page d'import

Interface complète avec drag & drop et sélection de fichier. Elle affiche un aperçu des clés avant l'import, puis envoie les données directement au content script de l'onglet cible.

### `utils/storage-parser.ts` — Le parser

Transforme le localStorage brut en données structurées. anime-sama.tv stocke ses données dans des tableaux parallèles :

- Historique : `histoUrl[0]`, `histoNom[0]`, `histoImg[0]` vont ensemble
- Watchlist : `watchlistUrl[0]`, `watchlistNom[0]`, `watchlistImg[0]`
- Favoris : `favoriUrl[0]`, `favoriNom[0]`, `favoriImg[0]`
- Progression : `savedEpName/catalogue/titre/anime/vostfr`, `savedEpNb/catalogue/...`

Le parser reconstruit tout ça en objets exploitables.

### `utils/json-handler.ts` — Export/Import de fichiers

`exportToJson()` prend un `Record<string, string>` et retourne un `Blob` JSON indenté. `importFromJson()` lit un fichier, vérifie qu'il s'agit d'un objet JSON valide avec des valeurs de type string. `downloadBlob()` crée un lien temporaire et déclenche le téléchargement.

## Ajouter une fonctionnalité

### Nouveau type de message

Pour ajouter une nouvelle action (par exemple vider le localStorage) :

1. Ajouter le handler dans `injected.ts` (ex : `AS_SYNC_CLEAR`)
2. Ajouter le case dans `content.ts` pour router le message
3. Ajouter le type dans `background.ts` ligne 4 (le filtre des types acceptés)
4. Appeler depuis le popup ou la page d'import

### Nouvelle donnée à parser

Si anime-sama.tv ajoute un nouveau type de données dans le localStorage :

1. Ajouter l'interface dans `utils/types.ts`
2. Ajouter la logique de parsing dans `utils/storage-parser.ts`
3. Afficher le résultat dans `popup/main.ts`

### Nouveau style

Le CSS reprend le design d'anime-sama.tv. Les couleurs principales :

- Fond : `#000000`
- Accent : `#0ea5e9` (le bleu du site)
- Texte : `#cbd5e1` (clair), `#9fb6c9` (secondaire), `#7f93a6` (discret)
- Bordures : `rgba(70, 100, 150, 0.15)`
- Erreurs : dégradé rouge `rgba(127, 29, 29)` → `rgba(91, 33, 33)`

## Debug

### Logs du popup

- Firefox : `about:debugging` → AS Sync → "Inspecter" → Console
- Chrome : clic droit sur l'icône → "Inspecter la fenêtre contextuelle"

### Logs du background

- Firefox : `about:debugging` → AS Sync → "Inspecter" (page d'arrière-plan)
- Chrome : `chrome://extensions` → AS Sync → "Vue du service worker"

### Logs du content script / injected

Ouvrez la console de la page web (F12). Les `console.log` du content script et du script injecté s'y affichent.

### Un message ne passe pas ?

Vérifiez dans cet ordre :

1. Le content script est-il chargé ? (vérifiez si `content.js` apparaît dans l'onglet Sources)
2. Le script injecté s'est-il exécuté ? (cherchez un listener sur `AS_SYNC_GET` dans la console)
3. Le background tourne-t-il ? (vérifiez dans `about:debugging`)
4. Le `postAndWait` expire-t-il ? (vous verrez "Timeout waiting for page script" dans la console)

### Firefox MV2 : "Content script not available"

La fonction `injectScript()` de WXT bloque sur Firefox MV2. Le contournement se trouve dans `content.ts` avec le `Promise.race`. Si le problème réapparaît, c'est probablement que le timeout de 100ms est trop court — essayez de l'augmenter.

## Commandes

```bash
npm run dev
npm run dev:firefox
npm run build
npm run build:firefox
npm run zip
npx wxt zip -b firefox
```
