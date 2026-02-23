# AS Sync

Extension pour sauvegarder et restaurer votre progression sur anime-sama.tv.

Quand le site change de domaine, vous perdez tout : historique, watchlist, favoris. Toutes ces données sont stockées dans votre navigateur et liées au nom de domaine. AS Sync vous permet de les exporter dans un fichier et de les réimporter sur le nouveau domaine.

**Aucune donnée n'est envoyée sur internet.** Tout reste en local, entre votre navigateur et votre fichier.

## Aperçu

![Aperçu](assets/AS-SYNC.gif)

## Fonctionnalités

- **Export** : récupère vos données depuis le site et les enregistre dans un fichier JSON
- **Import** : vous choisissez votre fichier, vous vérifiez son contenu, et l'extension remet tout en place
- **Résumé** : le popup affiche un aperçu de vos données (historique, watchlist, favoris)

Le fichier exporté est une copie exacte de vos données. Ce que vous exportez est réimporté tel quel.

## Installation

### Firefox

1. Rendez-vous sur `about:debugging#/runtime/this-firefox`
2. Cliquez sur "Charger un module complémentaire temporaire"
3. Sélectionnez le fichier `as-sync-1.0.0.xpi` ou le `manifest.json` du dossier `output/firefox-mv2/`

### Chrome

1. Rendez-vous sur `chrome://extensions`
2. Activez le "Mode développeur"
3. Cliquez sur "Charger l'extension non empaquetée" et sélectionnez le dossier `output/chrome-mv3/`

## Pour les développeurs

Si vous souhaitez comprendre le fonctionnement du code, corriger un bug ou ajouter une fonctionnalité, consultez le [README-DEV.md](README-DEV.md).

## Build

```bash
npm install
npm run build          # Chrome
npm run build:firefox  # Firefox
```

## Licence

[MIT](LICENSE)

## Auteur

[WaYyTempest](https://github.com/WaYyTempest)
