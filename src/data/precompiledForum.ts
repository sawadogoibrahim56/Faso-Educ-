import { ForumPost } from '../types';

export const precompiledForum: ForumPost[] = [
  {
    id: 'post-1',
    title: 'Comment bien comprendre le multiplicateur de budget en économie fermée avec fiscalité ?',
    author: 'Seydou Ouédraogo',
    authorRole: 'Candidat',
    category: 'Économie',
    content: `Bonjour à tous les futurs économistes de la fonction publique ! Je bloque sur un exercice typique pour le concours de Conseiller Économique.\n\nQuelle est la formule exacte du multiplicateur budgétaire keynésien lorsque la consommation dépend du revenu disponible, les impôts sont proportionnels $T = t \\cdot Y$, et qu'on a un taux de taxe marginal $t$ ?\n\nEst-ce que l'un d'entre vous aurait la démonstration complète sous la main avec le lag de transmission ? Merci d'avance ! $k = \\frac{1}{1 - c(1-t)}$ ?`,
    date: '21 Mai 2026 à 10:15',
    upvotes: 18,
    views: 142,
    isPinned: true,
    replies: [
      {
        id: 'reply-1-1',
        author: 'Dr. Albert Sawadogo',
        authorRole: 'Professeur',
        content: `Bonjour Seydou. Votre formule intermédiaire de multiplicateur est parfaitement correcte ! Voici la démonstration concise :\n\nL'équilibre global s'écrit :\n$$Y = C + I + G$$\n\nLa fonction de consommation dépend du revenu disponible $Y_d$ :\n$$C = c \\cdot Y_d + C_0 = c(Y - T) + C_0$$\n\nEn remplaçant les impôts $T = t \\cdot Y$, la fonction devient :\n$$C = c(Y - tY) + C_0 = c(1-t)Y + C_0$$\n\nEn réinjectant dans l'équation d'équilibre, nous obtenons :\n$$Y = c(1-t)Y + C_0 + I + G$$\n\nEn isolant $Y$ du membre de gauche, on factorise :\n$$Y [1 - c(1-t)] = C_0 + I + G$$\n\nLe multiplicateur d'économie fermée avec impôts proportionnels est donc bien :\n$$k = \\frac{1}{1 - c(1-t)}$$\n\nPuisque la propension marginale à consommer $c \\in ]0, 1[$ et le taux de taxe $t \\in ]0, 1[$, on a $0 < c(1-t) < 1$, ce qui garantit que $k > 1$. Bonnes révisions !`,
        date: '21 Mai 2026 à 11:30',
        upvotes: 12
      },
      {
        id: 'reply-1-2',
        author: 'Mariam Diallo',
        authorRole: 'Candidat',
        content: `Merci beaucoup Professeur, c'est limpide ! Avec $c = 0.8$ et $t = 0.25$, on obtient alors $k = \\frac{1}{1 - 0.8(0.75)} = \\frac{1}{1 - 0.6} = 2.5$. Une démonstration indispensable pour la composition d'économie générale !`,
        date: '21 Mai 2026 à 11:55',
        upvotes: 5
      }
    ]
  },
  {
    id: 'post-2',
    title: 'Astuce d\'estimation : pourquoi diviser par $n-1$ plutot que par $n$ ?',
    author: 'Kader Traoré',
    authorRole: 'Expert',
    category: 'Statistiques',
    content: `Bonjour l'équipe,\n\nLorsqu'on calcule la variance d'un échantillon statistique, on utilise souvent l'équation de la variance corrigée :\n$$S^2 = \\frac{1}{n-1} \\sum_{i=1}^n (x_i - \\bar{X})^2$$\n\nPourquoi cette soustraction de 1 au dénominateur ? C'est ce qu'on appelle la correction de Bessel. Elle permet d'éliminer le biais d'estimation ! En effet, si l'on divisait par $n$, on obtiendrait une sous-estimation systématique de la variance réelle de la population sous-jacente.`,
    date: '20 Mai 2026 à 18:40',
    upvotes: 24,
    views: 189,
    replies: [
      {
        id: 'reply-2-1',
        author: 'Idrissa Boni',
        authorRole: 'Candidat',
        content: `C'est excellent ! J'ai lu dans le cours de Statistique Mathématique de Faso Educ que l'espérance mathématique de la variance empirique classique est de $E(s^2) = \\frac{n-1}{n} \\sigma^2$. En multipliant par $\\frac{n}{n-1}$, on obtient exactement $E(S^2) = \\sigma^2$, d'où la variance non biaisée ! Tout s'assemble.`,
        date: '20 Mai 2026 à 20:10',
        upvotes: 8
      }
    ]
  },
  {
    id: 'post-3',
    title: 'Dates prévisionnelles de dépôt des dossiers - Concours Directs 2026',
    author: 'Admin Faso Educ',
    authorRole: 'Modérateur',
    category: 'Infos Concours',
    content: `Chers candidats,\n\nLes arrêtés d'ouverture pour les concours de la Fonction Publique de la session 2026 au Burkina Faso seront bientôt déposés de façon officielle.\n\n**Quelques conseils de préparation d'ici là :**\n1. Préparez vos pièces numérisées (CNIB légalisée, diplôme correspondant ou attestation de réussite).\n2. Validez votre compte sur la plateforme gouvernementale e-concours.\n3. Utilisez les modes **Test réeel** et **Concours** de Faso Educ chaque jour pour habituer votre cerveau à répondre sous stress temporel !\n\nL'effort quotidien est votre meilleur allié.`,
    date: '19 Mai 2026 à 08:00',
    upvotes: 42,
    views: 512,
    isPinned: true,
    replies: [
      {
        id: 'reply-3-1',
        author: 'Fousseni Barry',
        authorRole: 'Candidat',
        content: `Merci pour les conseils administratifs. Est-ce que le concours de l'ENAM a le même nombre de QCM cette année ? On m'a parlé de 50 questions de culture générale et de spécialité ?`,
        date: '19 Mai 2026 à 10:30',
        upvotes: 4
      },
      {
        id: 'reply-3-2',
        author: 'Admin Faso Educ',
        authorRole: 'Modérateur',
        content: `Oui Fousseni, c'est généralement 50 questions à choix multiples à compléter sur ordinateur de nos jours. D'où la configuration par défaut à 50 questions dans les réglages de notre simulateur Faso Educ !`,
        date: '19 Mai 2026 à 11:15',
        upvotes: 9
      }
    ]
  }
];
