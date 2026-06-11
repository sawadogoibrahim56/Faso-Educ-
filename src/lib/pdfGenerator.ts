import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { QuizResult, CourseData } from '../types';

/**
 * Parses and formats math/LaTeX expressions within text into a beautiful, 
 * highly readable standard mathematical notation for static PDFs.
 * This completely resolves the raw display of LaTeX commands (e.g. \lambda, \frac, \infty) 
 * so that they look premium, clear, and perfectly eligible for study.
 */
export const formatMathForPDF = (text: string): string => {
  if (!text) return "";

  const formatBlock = (math: string, isBlock: boolean = false): string => {
    let s = math;

    // 1. Clean spaces
    s = s.replace(/\s+/g, ' ');

    // 2. Correct missing backslashes or wrong notation in fractions
    s = s.replace(/(?<!\\)\b(fraction|frac)\s*\{/g, '\\frac{');
    s = s.replace(/\\fraction\s*\{/g, '\\frac{');
    s = s.replace(/\\?(?:fraction|frac)\s*\(([^)]+)\)\s*\(([^)]+)\)/g, '\\frac{$1}{$2}');

    const lowercaseGreek = 'alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|omicron|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega';
    const uppercaseGreek = 'Alpha|Beta|Gamma|Delta|Epsilon|Zeta|Eta|Theta|Iota|Kappa|Lambda|Mu|Nu|Xi|Omicron|Pi|Rho|Sigma|Tau|Upsilon|Phi|Chi|Psi|Omega';
    
    // Auto-restore missing backslashes for Greek variables
    const greekRegexLower = new RegExp(`(?<!\\\\)\\b(${lowercaseGreek})\\b`, 'g');
    const greekRegexUpper = new RegExp(`(?<!\\\\)\\b(${uppercaseGreek})\\b`, 'g');
    s = s.replace(greekRegexLower, '\\$1');
    s = s.replace(greekRegexUpper, '\\$1');

    s = s.replace(/(?<!\\)\bsomme\b/gi, '\\sum');
    s = s.replace(/(?<!\\)\bproduit\b/gi, '\\prod');
    s = s.replace(/(?<!\\)\binfini\b/gi, '\\infty');

    // 3. Robust math structure translations:
    // Fractions \frac{A}{B} to (A)/(B) (recursive to catch nested ones)
    for (let k = 0; k < 5; k++) {
      s = s.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1) / ($2)');
    }
    s = s.replace(/\\frac\s+([A-Za-z0-9])\s+([A-Za-z0-9])/g, '$1 / $2');

    // Simple fraction styling optimization (e.g. (x) / (y) -> x/y)
    s = s.replace(/\(([a-zA-Z0-9])\)\s*\/\s*\(([a-zA-Z0-9])\)/g, '$1/$2');

    // Superscripts and powers
    s = s.replace(/\^\{\s*2\s*\}/g, '²');
    s = s.replace(/\^2/g, '²');
    s = s.replace(/\^\{\s*3\s*\}/g, '³');
    s = s.replace(/\^3/g, '³');
    s = s.replace(/\^\{\s*n\s*\}/g, 'ⁿ');
    s = s.replace(/\^\{\s*x\s*\}/g, 'ˣ');
    s = s.replace(/\^\{\s*([^{}]+)\s*\}/g, '^($1)');

    // Subscripts
    s = s.replace(/_\{\s*([^{}]+)\s*\}/g, '_($1)');

    // Sum, product, integral notations
    s = s.replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, 'Σ($1 à $2)');
    s = s.replace(/\\sum_\{([^}]+)\}\^([a-zA-Z0-9])/g, 'Σ($1 à $2)');
    s = s.replace(/\\sum_([a-zA-Z0-9])\^([a-zA-Z0-9])/g, 'Σ($1 à $2)');
    s = s.replace(/\\sum_\{([^}]+)\}/g, 'Σ($1)');
    s = s.replace(/\\sum/g, 'Σ');

    s = s.replace(/\\prod_\{([^}]+)\}\^\{([^}]+)\}/g, '∏($1 à $2)');
    s = s.replace(/\\prod_\{([^}]+)\}\^([a-zA-Z0-9])/g, '∏($1 à $2)');
    s = s.replace(/\\prod_\{([^}]+)\}/g, '∏($1)');
    s = s.replace(/\\prod/g, '∏');

    s = s.replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, '∫(de $1 à $2)');
    s = s.replace(/\\int_\{([^}]+)\}\^([a-zA-Z0-9])/g, '∫(de $1 à $2)');
    s = s.replace(/\\int_([a-zA-Z0-9])\^([a-zA-Z0-9])/g, '∫(de $1 à $2)');
    s = s.replace(/\\int/g, '∫');

    s = s.replace(/\\lim_\{([^}]+)\}/g, 'Lim($1)');
    s = s.replace(/\\lim/g, 'Lim');

    s = s.replace(/\\sqrt\s*\{([^{}]+)\}/g, '√($1)');
    s = s.replace(/\\overline\s*\{([^{}]+)\}/g, '($1)̄');

    // Matrices and arrays
    s = s.replace(/\\begin\{[a-zA-Z]*matrix\}([\s\S]*?)\\end\{[a-zA-Z]*matrix\}/g, (match, body) => {
      return '[' + body.trim().replace(/&/g, ' | ').replace(/\\\\/g, ' ; ') + ']';
    });

    // 4. Translate known LaTeX symbols & Greek variables to clean, standard symbols
    const symbolMap: { [key: string]: string } = {
      '\\alpha': 'α',
      '\\beta': 'β',
      '\\gamma': 'γ',
      '\\delta': 'δ',
      '\\epsilon': 'ε',
      '\\zeta': 'ζ',
      '\\eta': 'η',
      '\\theta': 'θ',
      '\\iota': 'ι',
      '\\kappa': 'κ',
      '\\lambda': 'λ',
      '\\mu': 'μ',
      '\\nu': 'ν',
      '\\xi': 'ξ',
      '\\pi': 'π',
      '\\rho': 'ρ',
      '\\sigma': 'σ',
      '\\tau': 'τ',
      '\\upsilon': 'υ',
      '\\phi': 'φ',
      '\\chi': 'χ',
      '\\psi': 'ψ',
      '\\omega': 'ω',
      '\\Delta': 'Δ',
      '\\Sigma': 'Σ',
      '\\Omega': 'Ω',
      '\\Gamma': 'Γ',
      '\\Theta': 'Θ',
      '\\Phi': 'Φ',
      '\\Psi': 'Ψ',
      '\\infty': '∞',
      '\\pm': '±',
      '\\mp': '∓',
      '\\times': '×',
      '\\div': '÷',
      '\\le': '≤',
      '\\leq': '≤',
      '\\ge': '≥',
      '\\geq': '≥',
      '\\ne': '≠',
      '\\neq': '≠',
      '\\approx': '≈',
      '\\in': '∈',
      '\\notin': '∉',
      '\\ni': '∋',
      '\\forall': '∀',
      '\\exists': '∃',
      '\\rightarrow': '→',
      '\\to': '→',
      '\\implies': '⇒',
      '\\leftrightarrow': '↔',
      '\\partial': '∂',
      '\\nabla': '∇',
      '\\cdot': '·',
      '\\sqrt': '√',
      '\\propto': '∝',
      '\\cap': '∩',
      '\\cup': '∪',
      '\\subset': '⊂',
      '\\supset': '⊃',
      '\\subseteq': '⊆',
      '\\supseteq': '⊇',
      '\\varnothing': 'Ø',
      '\\emptyset': 'Ø',
      '\\aleph': 'ℵ',
      '\\hbar': 'ℏ',
    };

    Object.keys(symbolMap).forEach((cmd) => {
      const escapedCmd = cmd.replace(/\\/g, '\\\\');
      s = s.replace(new RegExp(`${escapedCmd}\\b`, 'g'), symbolMap[cmd]);
      s = s.replace(new RegExp(`${escapedCmd}`, 'g'), symbolMap[cmd]);
    });

    // Remove remaining formatting commands
    s = s.replace(/\\{/g, '{').replace(/\\}/g, '}');
    s = s.replace(/\\[,;!:]/g, ' ');
    s = s.replace(/\\(?![a-zA-Z])/g, '');

    if (isBlock) {
      return '\n    [ Formule : ' + s.trim() + ' ]\n';
    }
    return ' ' + s.trim() + ' ';
  };

  let formatted = text;
  
  // Format math blocks $$...$$ (Block math display)
  formatted = formatted.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    return formatBlock(formula, true);
  });

  // Format math inline $...$ (Inline math display)
  formatted = formatted.replace(/\$([^$]+)\$/g, (match, formula) => {
    return formatBlock(formula, false);
  });

  return formatted;
};

export const generateQuizPDF = (result: QuizResult) => {
  const doc = new jsPDF();
  const fasoGreen: [number, number, number] = [0, 158, 73];
  const fasoBlue: [number, number, number] = [0, 51, 160];
  
  // Header
  doc.setFillColor(fasoGreen[0], fasoGreen[1], fasoGreen[2]);
  doc.rect(0, 0, 210, 30, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text('Faso Educ - Questionnaire', 105, 20, { align: 'center' });
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text(`Sujets : ${result.subjects.join(', ')}`, 14, 40);
  doc.text(`Niveau : ${result.level} | Date : ${result.date}`, 14, 47);
  doc.text(`Score obtenu : ${result.score}/${result.totalQuestions}`, 14, 54);

  // Section 1: Questions
  doc.setFontSize(16);
  doc.setTextColor(fasoBlue[0], fasoBlue[1], fasoBlue[2]);
  doc.text('I. QUESTIONS', 14, 65);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);

  let currentY = 75;
  const pageHeight = doc.internal.pageSize.height;

  result.questions.forEach((q, i) => {
    // Check if we need a new page
    if (currentY > pageHeight - 40) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    const cleanQuestionText = formatMathForPDF(`${i + 1}. ${q.text}`);
    const questionLines = doc.splitTextToSize(cleanQuestionText, 180);
    doc.text(questionLines, 14, currentY);
    currentY += (questionLines.length * 5) + 2;

    doc.setFont('helvetica', 'normal');
    q.options.forEach((opt, oIdx) => {
      const letter = String.fromCharCode(65 + oIdx);
      const cleanOpt = formatMathForPDF(opt);
      const optionText = `${letter}) ${cleanOpt}`;
      const optionLines = doc.splitTextToSize(optionText, 170);
      doc.text(optionLines, 20, currentY);
      currentY += (optionLines.length * 5);
    });
    currentY += 5;
  });

  // Section 2: Corrigé (New Page)
  doc.addPage();
  doc.setFillColor(fasoGreen[0], fasoGreen[1], fasoGreen[2]);
  doc.rect(0, 0, 210, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('II. CORRIGÉ DÉTAILLÉ', 105, 13, { align: 'center' });

  const corrigéData = result.questions.map((q, i) => [
    i + 1,
    formatMathForPDF(q.options[q.correctAnswer]),
    formatMathForPDF(q.explanation)
  ]);

  autoTable(doc, {
    startY: 30,
    head: [['#', 'Réponse Correcte', 'Explication Pédagogique']],
    body: corrigéData,
    headStyles: { fillColor: fasoGreen },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 50 },
      2: { cellWidth: 120 },
    },
    styles: { fontSize: 9, cellPadding: 3 },
    alternateRowStyles: { fillColor: [245, 245, 245] }
  });
  
  doc.save(`FasoEduc_Quiz_${result.subjects[0].replace(/\s+/g, '_')}.pdf`);
};

export const generateCoursePDF = (course: CourseData) => {
  const doc = new jsPDF();
  const fasoGreen: [number, number, number] = [0, 158, 73];
  const fasoBlue: [number, number, number] = [0, 51, 160];
  
  // Header
  doc.setFillColor(fasoGreen[0], fasoGreen[1], fasoGreen[2]);
  doc.rect(0, 0, 210, 25, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  // Ensure title fits or truncate
  const splitTitle = doc.splitTextToSize(course.title, 180);
  doc.text(splitTitle, 105, 12, { align: 'center' });
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Catégorie : ${course.category}`, 14, 35);
  doc.text(`Niveau : ${course.level} | Sujet : ${course.subject}`, 14, 41);
  doc.setFont('helvetica', 'normal');
  doc.text(`Académie Faso Educ • Études de Préparation aux Concours`, 14, 47);
  
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(14, 52, 196, 52);

  let currentY = 62;
  const pageHeight = doc.internal.pageSize.height;

  // Description
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const descLines = doc.splitTextToSize(course.description, 180);
  doc.text(descLines, 14, currentY);
  currentY += (descLines.length * 5) + 10;

  course.chapters.forEach((chapter, cIdx) => {
    if (currentY > pageHeight - 35) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(fasoBlue[0], fasoBlue[1], fasoBlue[2]);
    doc.text(`Chapitre ${cIdx + 1} : ${chapter.title}`, 14, currentY);
    currentY += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);

    // Render LaTeX formulas into high-quality math text on PDF using our central formatter
    const formattedContent = formatMathForPDF(chapter.content);

    const storyLines = doc.splitTextToSize(formattedContent, 180);
    storyLines.forEach((line: string) => {
      if (currentY > pageHeight - 20) {
         doc.addPage();
         currentY = 20;
      }
      doc.text(line, 14, currentY);
      currentY += 5.5;
    });

    currentY += 8; // Chapter separation
  });

  // Footer on last page or general
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Généré de façon automatisée et académique par Faso Educ. Tous droits réservés.', 105, pageHeight - 10, { align: 'center' });

  doc.save(`FasoEduc_Cours_${course.title.replace(/\s+/g, '_')}.pdf`);
};
