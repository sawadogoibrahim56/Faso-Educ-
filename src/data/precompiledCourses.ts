import { Level } from '../types';

export interface CourseData {
  id: string;
  title: string;
  category: string;
  subject: string;
  level: Level;
  description: string;
  chapters: {
    title: string;
    content: string;
    summary?: string;
  }[];
  userEmail?: string;
  isPublic?: boolean;
}

export const precompiledCourses: CourseData[] = [
  {
    id: 'course-micro-1',
    title: 'Microéconomie : Théorie Moderne du Consommateur',
    category: 'Microéconomie',
    subject: 'Économie',
    level: 'Licence',
    description: 'Analyse rigoureuse de la maximisation de l\'utilité, des courbes d\'indifférence et de la déduction de la demande sous contrainte de budget.',
    chapters: [
      {
        title: 'La Fonction d\'Utilité et les Préférences',
        summary: 'Étude de la rationalité économique, représentée par une fonction d\'utilité U(x1, x2), des axiomes fondamentaux (complétude, transitivité, non-satiété) et de l\'élasticité de substitution.',
        content: `La théorie du consommateur repose sur l'hypothèse de rationalité de l'agent économique. Ce dernier cherche à maximiser sa satisfaction, représentée par une fonction d'utilité $U(x_1, x_2)$, sous la contrainte de ses ressources limitées.\n\nLes préférences du consommateur sont caractérisées par trois axiomes fondamentaux :\n1. **La complétude** : L'agent peut comparer tous les paniers de biens.\n2. **La transitivité** : Si $A \\succeq B$ et $B \\succeq C$, alors $A \\succeq C$.\n3. **La non-satiété** (ou monotonicité) : L'agent préfère toujours consommer plus de biens que moins.\n\nUne fonction d'utilité couramment utilisée pour modéliser les préférences régulières est la fonction de **Cobb-Douglas** :\n$$U(x_1, x_2) = x_1^\\alpha x_2^{1-\\alpha}$$\nou $\\alpha \\in ]0, 1[$ représente la part relative accordée au bien 1. L'élasticité de substitution entre les deux biens est égale à l'unité ($1$), indiquant une substitution constante et fluide entre les biens.`
      },
      {
        title: 'Le Taux Marginal de Substitution (TMS)',
        summary: 'Calcul du TMS comme le rapport des utilités marginales partielles d\'une fonction d\'utilité, mesure du sacrifice consenti, et convexité des préférences.',
        content: `Le Taux Marginal de Substitution ($TMS$) mesure la quantité d'un bien $x_2$ qu'un consommateur est disposé à abandonner pour obtenir une unité supplémentaire du bien $x_1$, tout en maintenant son niveau d'utilité constant.\n\nGraphiquement, le $TMS$ correspond à la pente de la courbe d'indifférence en un point donné. Mathématiquement, il s'exprime comme le rapport des utilités marginales :\n$$TMS_{1,2} = -\\frac{dx_2}{dx_1} = \\frac{Um_1}{Um_2} = \\frac{\\partial U / \\partial x_1}{\\partial U / \\partial x_2}$$\n\nPour la fonction de Cobb-Douglas $U(x_1, x_2) = x_1^\\alpha x_2^{1-\\alpha}$, calculons les utilités marginales :\n- $Um_1 = \\frac{\\partial U}{\\partial x_1} = \\alpha x_1^{\\alpha-1} x_2^{1-\\alpha}$\n- $Um_2 = \\frac{\\partial U}{\\partial x_2} = (1-\\alpha) x_1^\\alpha x_2^{-\\alpha}$\n\nEn effectuant le rapport, nous obtenons :\n$$TMS_{1,2} = \\frac{\\alpha}{1-\\alpha} \\cdot \\frac{x_2}{x_1}$$\nCe taux décroît à mesure que le bien $x_1$ se substitue au bien $x_2$, traduisant la convexité des préférences des consommateurs.`
      },
      {
        title: 'L\'Équilibre du Consommateur et l\'Optimisation',
        summary: 'Résolution analytique du programme de maximisation par la méthode du Lagrangien sous contrainte de budget, et calcul des fonctions de demande optimale.',
        content: `Le consommateur maximise son utilité sous une contrainte de budget. Soit $R$ le revenu nominal disponible, $p_1$ le prix unitaire du bien 1, et $p_2$ le prix du bien 2. L'équation de la droite de budget s'écrit :\n$$p_1 x_1 + p_2 x_2 = R$$\n\nLe programme de maximisation s'énonce :\n$$\\max_{x_1, x_2} U(x_1, x_2) \\quad \\text{sous contrainte} \\quad p_1 x_1 + p_2 x_2 = R$$\n\nPour résoudre ce problème, on utilise la méthode de Lagrange. Le Lagrangien s'écrit :\n$$\\mathcal{L}(x_1, x_2, \\lambda) = U(x_1, x_2) + \\lambda (R - p_1 x_1 - p_2 x_2)$$\n\nLes conditions de premier ordre (CPO) s'obtiennent en annulant les dérivées partielles :\n1. $\\frac{\\partial \\mathcal{L}}{\\partial x_1} = Um_1 - \\lambda p_1 = 0 \\implies Um_1 = \\lambda p_1$\n2. $\\frac{\\partial \\mathcal{L}}{\\partial x_2} = Um_2 - \\lambda p_2 = 0 \\implies Um_2 = \\lambda p_2$\n3. $\\frac{\\partial \\mathcal{L}}{\\partial \\lambda} = R - p_1 x_1 - p_2 x_2 = 0$\n\nEn divisant la première équation par la seconde, nous déduisons la condition d'optimalité :\n$$TMS_{1,2} = \\frac{p_1}{p_2}$$\nA l'équilibre, le taux auquel le consommateur est psychologiquement prêt à substituer les biens est rigoureusement égal au taux d'échange marchand (le rapport des prix). En substituant cette égalité dans la droite de budget pour le cas de la Cobb-Douglas, nous obtenons les demandes optimales :\n$$x_1^* = \\frac{\\alpha R}{p_1} \\quad \\text{et} \\quad x_2^* = \\frac{(1-\\alpha) R}{p_2}$$\nCes fonctions indiquent que le consommateur consacre une fraction constante de son revenu à l'achat de chaque bien.`
      },
      {
        title: 'La Théorie de la Production et Facteurs de Production',
        summary: 'Étude théorique des fonctions de production de court et long terme, de la combinaison optimale des facteurs Capital (K) et Travail (L), et des rendements d\'échelle.',
        content: ''
      },
      {
        title: 'La Structure des Coûts : Court et Long Terme',
        summary: 'Analyse analytique des fonctions de coûts de production (Coût Fixe, Coût Variable, Coût Moyen, Coût Marginal), et étude des équilibres financiers.',
        content: ''
      },
      {
        title: 'L\'Équilibre des Marchés : Concurrence Parfaite et Monopole',
        summary: 'Modélisation des équilibres sous concurrence pure et parfaite comparée au monopole discriminant et non-discriminant, et calcul de la perte sèche de Harberger.',
        content: ''
      }
    ]
  },
  {
    id: 'course-macro-1',
    title: 'Macroéconomie : Équilibre Général et Modèle IS-LM',
    category: 'Macroéconomie',
    subject: 'Économie',
    level: 'Licence',
    description: 'Modélisation macroéconomique des interactions entre le marché des biens et services (IS) et le marché de la monnaie (LM). Analyse d\'impact des politiques budgétaires et monétaires.',
    chapters: [
      {
        title: 'Le Marché des Biens et Services (Courbe IS)',
        summary: 'Détermination du revenu national d\'équilibre dans un modèle keynésien, rôle d\'amortisseur du taux d\'intérêt sur l\'investissement, et calcul analytique du multiplicateur.',
        content: `La courbe IS représente l'ensemble des combinaisons de revenu global ($Y$) et de taux d'intérêt ($r$) qui réalisent l'équilibre sur le marché des biens et services de l'économie.\n\nDans un modèle simplifié en économie fermée avec gouvernement, le revenu d'équilibre $Y$ s'écrit :\n$$Y = C + I + G$$\n\nOù :\n- $C$ est la consommation privée, modélisée par $C = c(Y - T) + C_0$, avec $c \\in ]0, 1[$ la propension marginale à consommer et $T$ les impôts.\n- $I$ est l'investissement privé, qui dépend négativement du taux d'intérêt : $I = I_0 - d \\cdot r$ (où $d > 0$ de mesure la sensibilité de l'investissement au coût du capital).\n- $G$ représente les dépenses publiques de l'État.\n\nEn substituant ces fonctions dans l'équation d'équilibre, nous obtenons :\n$$Y = c(Y - T) + C_0 + I_0 - d \\cdot r + G$$\n\nEn isolant $Y$, nous formulons l'équation de la courbe IS :\n$$Y = \\frac{1}{1-c} (C_0 + I_0 + G - cT) - \\frac{d}{1-c} \\cdot r$$\nOn note le multiplicateur keynésien par : $k = \\frac{1}{1-c}$. Puisque $0 < c < 1$, nous constatons que $k > 1$. La courbe IS possède une pente négative dans l'espace $(Y, r)$ car une baisse du taux d'intérêt stimule l'investissement, ce qui accroît le revenu national par le jeu du multiplicateur.`
      },
      {
        title: 'Le Marché de la Monnaie (Courbe LM)',
        summary: 'Analyse de l\'équilibre sur le marché de la monnaie, équation de l\'offre et de la demande de monnaie (motifs de transaction, précaution et spéculation) et équation analytique LM.',
        content: `La courbe LM traduit l'équilibre sur le marché de la monnaie, caractérisé par l'égalité entre l'offre de monnaie réelle de la banque centrale et la demande de monnaie globale des agents économiques.\n\n'L'offre de monnaie réelle nominale déflatée par les prix est constante à court terme : $M^s/P$.\n\nLa demande de liquide ou demande de monnaie réelle ($L$) est motivée par deux aspects fondamentaux :\n1. **Le motif de transaction et de précaution** : proportionnel au niveau de revenu national $Y$ ($k \\cdot Y$).\n2. **Le motif de spéculation** : inversement corrélé au taux d'intérêt alternatif $r$ ($-h \\cdot r$ où $h > 0$ est la sensibilité spéculative).\n\nL'équilibre s'énonce :\n$$\\frac{M}{P} = k \\cdot Y - h \\cdot r$$\n\nEn exprimant le taux d'intérêt en fonction du revenu, nous obtenons l'équation analytique de la courbe LM :\n$$r = \\frac{k}{h} \\cdot Y - \\frac{1}{h} \\cdot \\frac{M}{P}$$\nLa courbe LM possède une pente positive dans l'espace $(Y, r)$. Si l'activité économique $Y$ augmente, la demande de monnaie pour motif de transaction s'accroît. Pour rétablir l'équilibre sur le marché monétaire face à une offre de monnaie inchangée, le taux d'intérêt doit monter pour freiner la demande de monnaie de spéculation.`
      },
      {
        title: 'Équilibre IS-LM et Politiques Économiques',
        summary: 'Résolution mathématique de l\'intersection des courbes IS et LM, étude d\'impact de la relance budgétaire (effet d\'éviction financière) et de la relance monétaire.',
        content: `L'équilibre global macroéconomique combine les équilibres simultanés des biens et de la monnaie : c'est l'intersection des courbes IS et LM.\n\n$$\\begin{cases} Y = k \\cdot A - k \\cdot d \\cdot r & \\text{(IS)} \\\\ r = \\frac{k_{lm}}{h} Y - \\frac{1}{h} \\frac{M}{P} & \\text{(LM)} \\end{cases}$$\nOù $A = C_0 + I_0 + G - cT$ représente la demande autonome totale de l'économie.\n\nCe cadre permet d'analyser deux types importants d'arbitrages et de politiques publiques :\n1. **La Politique Budgétaire Expansive** ($G \\uparrow$) : Déplace IS vers la droite. Cela engendre une hausse du PIB mais provoque également une hausse du taux d'intérêt $r$, ce qui décourage une partie de l'investissement privé. C'est l'effet d'éviction fiscale ou financière, d'autant plus fort que $h$ (sensibilité de la demande de monnaie au taux d'intérêt) est faible.\n2. **La Politique Monétaire Expansive** ($M \\uparrow$) : Déplace LM vers la droite. Cela contribue à réduire le taux d'intérêt de l'économie, ce qui baisse la barrière du coût du capital et stimule l'investissement et ainsi le revenu à travers l'effet de transmission monétaire.`
      },
      {
        title: 'La relation Chômage-Inflation et la Courbe de Phillips',
        summary: 'Arbitrage entre chômage et inflation à court terme, neutralité de la monnaie à long terme chez Milton Friedman et introduction des anticipations adaptatives.',
        content: ''
      },
      {
        title: 'L\'Économie Ouverte et le Modèle Mundell-Fleming',
        summary: 'Extension du modèle IS-LM en économie ouverte, étude de l\'impact des politiques publiques sous régime de change fixe et sous taux de change flexible.',
        content: ''
      },
      {
        title: 'La Théorie de la Croissance à Long Terme et Modèle de Solow',
        summary: 'Modélisation de l\'accumulation de capital physique par travailleur, recherche de l\'état stationnaire, règle d\'or d\'accumulation et résidu de Solow (progrès technique).',
        content: ''
      }
    ]
  },
  {
    id: 'course-stats-1',
    title: 'Statistiques Mathématiques : Indicateurs et Estimation',
    category: 'Statistiques',
    subject: 'Statistiques',
    level: 'Licence',
    description: 'Bases formelles de l\'estimation statistique, variables aléatoires, théories des échantillons et calcul des moments.',
    chapters: [
      {
        title: 'Mesures de Tendance Centrale et de Dispersion',
        summary: 'Concepts théoriques et empiriques autour de la moyenne arithmétique globale, de la variance empirique, de la méthode de Koenig-Huygens et de l\'écart-type.',
        content: `En statistique descriptive, nous résumons l'information d'un échantillon de taille $n$ par des moments empiriques de premier et second ordre.\n\nSoit $X = \\{x_1, x_2, \\dots, x_n\\}$ un échantillon d'observations d'une variable aléatoire quantitative. La **moyenne arithmétique empirique** s'exprime par :\n$$\\bar{X} = \\frac{1}{n} \\sum_{i=1}^{n} x_i$$\nLa moyenne possède la propriété de linéarité et minimise la somme des carrés des écarts : $\\sum_{i=1}^n (x_i - c)^2$ est minimale pour $c = \\bar{X}$.\n\nPour quantifier la dispersion des données autour de cette moyenne, nous calculons la **variance empirique** de l'échantillon :\n$$s^2 = \\frac{1}{n} \\sum_{i=1}^{n} (x_i - \\bar{X})^2$$\nPar application algébrique de la méthode de Koenig-Huygens, on peut réécrire la variance comme l'écart moyen du carré moins le carré de la moyenne :\n$$s^2 = \\left( \\frac{1}{n} \\sum_{i=1}^{n} x_i^2 \\right) - \\bar{X}^2$$\nL'écart-type est défini par la racine carrée de la variance : $s = \\sqrt{s^2}$..`
      },
      {
        title: 'Estimation Ponctuelle et Propriétés',
        summary: 'Critères formels des bons estimateurs ponctuels : étude détaillée du non-biais, de la variance des estimateurs et de l\'estimateur sans biais de la variance corrigée.',
        content: `L'objectif de la statistique décisionnelle est d'estimer les paramètres d'une population globale (tels que la moyenne inconnue $\\mu$ ou la variance $\\sigma^2$) à partir d'un échantillon représentatif prélevé au hasard.\n\nUn **estimateur** $T_n = g(X_1, \\dots, X_n)$ est une variable aléatoire dont la valeur observée sert d'estimation.\n\nUn bon estimateur doit satisfaire à trois critères majeurs :\n1. **Le non-biais** : L'espérance mathématique de l'estimateur doit être égale au vrai paramètre.\n$$E(T_n) = \\theta$$\nAnalysons le biais de la variance empirique $s^2$. En calculant son espérance mathématique, nous trouvons :\n$$E(s^2) = \\frac{n-1}{n} \\sigma^2 \\neq \\sigma^2$$\nLa variance empirique simple est donc biaisée à court terme. Pour corriger ce biais, on définit la **variance empirique corrigée** ($s_c^2$, notée parfois $S^2$) :\n$$S^2 = \\frac{n}{n-1} s^2 = \\frac{1}{n-1} \\sum_{i=1}^n (x_i - \\bar{X})^2$$\nqui vérifie $E(S^2) = \\sigma^2$, ce qui en fait un estimateur sans biais.\n\n2. **La convergence** : À mesure que la taille de l'échantillon $n$ tend vers l'infini, la probabilité d'écart entre l'estimateur et la cible physique s'annule.\n3. **L'efficacité** : Parmi tous les estimateurs possibles sans biais, on choisit celui qui minimise la variance empirique de l'estimateur.`
      },
      {
        title: 'Le Théorème de la Limite Centrale (TLC)',
        summary: 'Théorème fondamental de l\'inférence statistique : convergence en loi de la moyenne centrée réduite vers une loi normale centrée réduite.',
        content: `Le Théorème de la Limite Centrale ($TLC$) est le pilier de l'inférence statistique et de la construction des intervalles de confiance.\n\nSoit $X_1, X_2, \\dots, X_n$ une suite de variables aléatoires indépendantes et identiquement distribuées, d'espérance finie $E(X_i) = \\mu$ et de variance finie $V(X_i) = \\sigma^2$.\n\nLorsque la taille de l'échantillon $n$ grandit ($n \\ge 30$), la somme ou la moyenne de ces variables converge en loi vers une distribution normale, peu importe la loi de distribution initiale de $X_i$ dans la population.\n\nLa variable centrée réduite issue de la moyenne empirique converge en loi :\n$$Z_n = \\frac{\\bar{X} - \\mu}{\\sigma / \\sqrt{n}} \\xrightarrow[n \\to \\infty]{\\mathcal{L}} \\mathcal{N}(0, 1)$$\nCe résultat crucial permet d'approcher la loi de la moyenne de l'échantillon par $\\bar{X} \\sim \\mathcal{N}\\left(\\mu, \\frac{\\sigma^2}{n}\\right)$ et de définir des seuils de confiance rigoureux.`
      },
      {
        title: 'Estimation par Intervalle de Confiance',
        summary: 'Formules de calcul théorique et application pratique pour déterminer les intervalles de confiance (loi normale, loi de Student pour petits échantillons).',
        content: ''
      },
      {
        title: 'Tests d\'Hypothèses Statistiques et Risques d\'Erreurs',
        summary: 'Définition des hypothèses théoriques H0 et H1, calcul de la région de rejet critique, risques d\'erreur de type I (alpha) et de type II (beta).',
        content: ''
      },
      {
        title: 'Les Tests d\'Indépendance et de Conformité du Chi-Deux (χ²)',
        summary: 'Tests non-paramétriques pour éprouver l\'indépendance de caractères ou l\'ajustement d\'une loi empirique à une loi théorique.',
        content: ''
      }
    ]
  },
  {
    id: 'course-maths-1',
    title: 'Mathématiques Appliquées pour Concours Administratifs',
    category: 'Mathématiques',
    subject: 'Mathématiques',
    level: 'Licence',
    description: 'Outils quantitatifs avancés : algèbre linéaire, optimisation différentielle de fonctions à plusieurs variables et calcul intégral de haut niveau.',
    chapters: [
      {
        title: 'Algèbre Linéaire : Espaces Vectoriels et Matrices',
        summary: 'Base vectorielle, dimension d\'un espace, calcul matriciel avancée, inversion de matrices, et résolution de systèmes linéaires homogènes.',
        content: ''
      },
      {
        title: 'Optimisation Libres et sous Contraintes d\'Égalités',
        summary: 'Recherche des conditions de premier ordre pour les extremums locaux, multiplicateurs de Lagrange, matrice Hessienne récurrente et vérification du second ordre.',
        content: ''
      },
      {
        title: 'Calcul Intégral : Intégrales Multiples et Généralisées',
        summary: 'Techniques d\'intégration par parties partielles, théorème de Fubini pour les intégrations doubles, calcul de l\'intégrale de Gauss en probabilités.',
        content: ''
      },
      {
        title: 'Équations Différentielles de Premier et Second Ordre',
        summary: 'Résolution analytique globale des équations différentielles linéaires homogènes ou avec second membre de type polynomial ou trigonométrique.',
        content: ''
      }
    ]
  }
];
