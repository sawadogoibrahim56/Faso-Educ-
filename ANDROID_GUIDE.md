# 📱 Guide de Téléchargement Direct de l'APK Faso-Educ (Zéro Outil Local Requis !)

Bonne nouvelle ! Vous n'avez **plus du tout besoin d'installer Android Studio**, de configurer de Java, ou de faire de manipulations complexes sur votre ordinateur. 

Nous avons configuré un compilateur automatique sur **GitHub Actions** qui fait tout le travail difficile à votre place. À chaque modification ou déploiement sur votre dépôt GitHub, les serveurs de GitHub compilent directement le front-end et génèrent l'application sous forme de fichier **`.apk` installable** en quelques minutes !

---

## 🚀 Étape Unique : Télécharger l'APK directement depuis GitHub

1. Rendez-vous sur votre dépôt **GitHub**.
2. Cliquez sur l'onglet **`Actions`** situé en haut de la page.
3. Vous verrez une liste de builds (workflows). Cliquez sur le run le plus récent de **"Faso-Educ Automated Frontend & Android Compiler"**.
4. Faites défiler la page tout en bas jusqu'à la section **`Artifacts`** (Artefacts).
5. Vous y trouverez un fichier nommé **`faso-educ-android-apk`** :
   - Cliquez dessus pour le télécharger sous forme de fichier `.zip`.
   - Décompressez le fichier `.zip` sur votre ordinateur ou votre téléphone Android pour obtenir le fichier **`faso-educ-debug.apk`**.
6. Transférez-le sur votre téléphone Android et ouvrez-le pour installer l'application Faso-Educ instantanément !

---

## 🔒 Connexion Authentique et Sécurité de Production

Comment l'application Android communique-t-elle avec votre base de données et l'IA ?
- **Détection Automatique de l'Environnement** : Le système de routage réseau de l'application (situé dans `src/lib/api.ts`) détecte automatiquement qu'il est exécuté en tant qu'application mobile native (via les protocoles locaux de Capacitor ou WebView).
- **Routage Direct de Production** : Il connecte automatiquement et en toute sécurité l'application à votre serveur de production en ligne : `https://faso-educ-backend.onrender.com`.
- **Protection des Clés** : Toutes les requêtes sensibles et l'intégration de l'intelligence artificielle (Gemini API) sont exécutées de manière sécurisée côté serveur. Vos clés secrètes ne sont jamais exposées dans l'APK.
- **Chiffrement SSL** : Toutes vos données d'études, de forum, de quiz et d'abonnement sont cryptées en transit.
