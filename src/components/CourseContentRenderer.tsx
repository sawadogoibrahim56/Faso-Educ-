import React from 'react';
import { MathRenderer } from './MathRenderer';

interface CourseContentRendererProps {
  content: string;
}

export const CourseContentRenderer: React.FC<CourseContentRendererProps> = ({ content }) => {
  if (!content) return null;

  // Split by newlines to parse line-by-line markdown
  const lines = content.split('\n');
  const renderedElements: React.JSX.Element[] = [];

  let currentListItems: string[] = [];

  const flushList = (key: number) => {
    if (currentListItems.length > 0) {
      renderedElements.push(
        <ul key={`list-${key}`} className="list-disc pl-6 space-y-2.5 my-4 text-gray-700 dark:text-gray-300">
          {currentListItems.map((item, itemIdx) => (
            <li key={itemIdx} className="leading-relaxed text-sm sm:text-base">
              <MathRenderer text={item} />
            </li>
          ))}
        </ul>
      );
      currentListItems = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList(index);
      return;
    }

    // Check for headings: ### or ## or #
    if (trimmed.startsWith('###')) {
      flushList(index);
      const headerText = trimmed.replace(/^###\s*/, '');
      renderedElements.push(
        <h4 key={index} className="text-base sm:text-lg font-black text-faso-blue dark:text-blue-400 mt-6 mb-2.5 tracking-tight">
          <MathRenderer text={headerText} />
        </h4>
      );
    } else if (trimmed.startsWith('##')) {
      flushList(index);
      const headerText = trimmed.replace(/^##\s*/, '');
      renderedElements.push(
        <h3 key={index} className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white mt-8 mb-3.5 tracking-tight">
          <MathRenderer text={headerText} />
        </h3>
      );
    } else if (trimmed.startsWith('#')) {
      flushList(index);
      const headerText = trimmed.replace(/^#\s*/, '');
      renderedElements.push(
        <h2 key={index} className="text-xl sm:text-2xl font-black text-gray-950 dark:text-white mt-9 mb-4.5 tracking-tight border-b pb-2 border-gray-100 dark:border-gray-800">
          <MathRenderer text={headerText} />
        </h2>
      );
    } 
    // Check for list items: starting with - or * (and not $$ math block or ** bold start)
    else if ((trimmed.startsWith('-') || trimmed.startsWith('*')) && !trimmed.startsWith('$$') && !trimmed.startsWith('**')) {
      const itemText = trimmed.replace(/^[-*]\s*/, '');
      currentListItems.push(itemText);
    } 
    // Standard paragraphs
    else {
      flushList(index);
      renderedElements.push(
        <p key={index} className="text-gray-800 dark:text-gray-200 text-sm sm:text-base leading-relaxed my-3">
          <MathRenderer text={trimmed} />
        </p>
      );
    }
  });

  flushList(lines.length);

  return <div className="space-y-3">{renderedElements}</div>;
};
