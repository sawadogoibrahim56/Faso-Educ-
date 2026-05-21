# 🗄️ Guide de Configuration Supabase & Déploiement Render — ReFaso Educ

Ce document contient l'ensemble des instructions techniques et les scripts SQL nécessaires pour faire migrer l'application **ReFaso Educ** de l'évaluation simulée locale vers une infrastructure de production complète avec **Supabase** (Base de données Postgres) et **Render** (Hébergement Server-side Node.js/Express).

---

## 1. Structure de la Base de Données (Supabase SQL)

Connectez-vous à votre tableau de bord [Supabase](https://supabase.com), rendez-vous dans le **SQL Editor** et exécutez le script suivant pour créer les tables requises :

```sql
-- 1. Table des utilisateurs / Candidats
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    level TEXT DEFAULT 'Licence',
    target_exam TEXT,
    region_name TEXT,
    avatar TEXT DEFAULT '👨‍🎓',
    is_premium BOOLEAN DEFAULT FALSE,
    points INTEGER DEFAULT 0,
    learning_streak INTEGER DEFAULT 0,
    is_banned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index pour accélérer les recherches d'emails
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 2. Table des déclarations de paiement manuel (Récépissés)
CREATE TABLE IF NOT EXISTS public.manual_payments (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    user_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    operator TEXT NOT NULL, -- 'orange' | 'moov' | 'wave'
    amount INTEGER NOT NULL,
    reference TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
    reject_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Table des questions de révision sauvegardées (Favoris d'étude)
CREATE TABLE IF NOT EXISTS public.favorited_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    question_text TEXT NOT NULL,
    options TEXT[] NOT NULL,
    correct_answer INTEGER NOT NULL,
    explanation TEXT NOT NULL,
    dimension TEXT NOT NULL,
    subject TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Créez des règles de sécurité basiques (RLS) ou laissez en mode public-permit pour commencer simple.
```

---

## 2. Variables d'Environnement Recommandées (`.env`)

Pour connecter l'application au serveur final de Render et à Supabase, configurez les variables d'environnement suivantes dans les paramètres de votre service sur Render :

```env
# Clé secrète de l'API Google Gemini (requis côté serveur uniquement)
GEMINI_API_KEY="AIzaSy..."

# Configuration Supabase (Utilisées côté client par Vite)
VITE_SUPABASE_URL="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsIn..."

# URL de l'application déployée
APP_URL="https://refaso-educ.onrender.com"
NODE_ENV="production"
```

---

## 3. Déploiement sur Render (Étape par Étape)

1. **Liez votre dépôt GitHub** contenant le code exporté.
2. **Créez un nouveau "Web Service"** sur Render.
3. Configurez les paramètres de build :
   - **Environment** : `Node`
   - **Build Command** : `npm run build` (génère le bundle client statique et compile le serveur (`server.ts` en `dist/server.cjs` via `esbuild`))
   - **Start Command** : `npm start` (lance légitimement `node dist/server.cjs`)
4. Allez dans l'onglet **Env Groups / Environment Variables** et insérez les clés ci-dessus.
5. Déployez ! L'application fonctionne désormais en Full-Stack optimal.

---

## 🛠️ Espace de Gestion Privé Ibrahim Sawadogo

- **Adresse administrateur d'excellence** : `ibrahimsawadogo36@gmail.com`
- **Code secret d'accès d'usine** : `IBRAHIM_FASO_2026`
- **Actions disponibles** :
  - **Validation en 1 clic** : Active instantanément l'accès premium du candidat.
  - **Rejet motivé** : Permet de désapprouver si le numéro de reçu ou l'expéditeur ne correspond pas.
  - **Bannissement de sécurité** : Coupe l'intégralité des accès au site à un fauteur de trouble ou un faux payeur récurent.
