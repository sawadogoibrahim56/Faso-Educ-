import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { QuizResult, CourseData } from '../types';

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
    const questionLines = doc.splitTextToSize(`${i + 1}. ${q.text}`, 180);
    doc.text(questionLines, 14, currentY);
    currentY += (questionLines.length * 5) + 2;

    doc.setFont('helvetica', 'normal');
    q.options.forEach((opt, oIdx) => {
      const letter = String.fromCharCode(65 + oIdx);
      const optionText = `${letter}) ${opt}`;
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
    q.options[q.correctAnswer],
    q.explanation
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

    // Clean LaTeX syntax slightly for standard representation in static PDF
    const preCleanStr = chapter.content
      .replace(/\$\$([\s\S]*?)\$\$/g, '\n[ÉQUATION]: $1\n') // Block equations block
      .replace(/\$([\s\S]*?)\$/g, ' $1 '); // Inline equations block

    const storyLines = doc.splitTextToSize(preCleanStr, 180);
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
