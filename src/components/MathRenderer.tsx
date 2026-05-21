import React from 'react';
import katex from 'katex';

interface MathRendererProps {
  text: string;
  className?: string;
}

export const MathRenderer: React.FC<MathRendererProps> = ({ text, className }) => {
  if (!text) return null;

  const parts: { type: 'text' | 'inline-math' | 'block-math'; content: string }[] = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    const nextBlockStart = text.indexOf('$$', currentIndex);
    const nextInlineStart = text.indexOf('$', currentIndex);

    if (nextBlockStart !== -1 && (nextInlineStart === -1 || nextBlockStart <= nextInlineStart)) {
      if (nextBlockStart > currentIndex) {
        parts.push({ type: 'text', content: text.substring(currentIndex, nextBlockStart) });
      }

      const blockEnd = text.indexOf('$$', nextBlockStart + 2);
      if (blockEnd !== -1) {
        parts.push({ type: 'block-math', content: text.substring(nextBlockStart + 2, blockEnd) });
        currentIndex = blockEnd + 2;
      } else {
        parts.push({ type: 'text', content: text.substring(nextBlockStart) });
        currentIndex = text.length;
      }
    } else if (nextInlineStart !== -1) {
      if (nextInlineStart > currentIndex) {
        parts.push({ type: 'text', content: text.substring(currentIndex, nextInlineStart) });
      }

      const inlineEnd = text.indexOf('$', nextInlineStart + 1);
      if (inlineEnd !== -1) {
        parts.push({ type: 'inline-math', content: text.substring(nextInlineStart + 1, inlineEnd) });
        currentIndex = inlineEnd + 1;
      } else {
        parts.push({ type: 'text', content: text.substring(nextInlineStart) });
        currentIndex = text.length;
      }
    } else {
      parts.push({ type: 'text', content: text.substring(currentIndex) });
      currentIndex = text.length;
    }
  }

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return <span key={index}>{part.content}</span>;
        }

        const isBlock = part.type === 'block-math';
        try {
          const html = katex.renderToString(part.content, {
            displayMode: isBlock,
            throwOnError: false,
          });

          if (isBlock) {
            return (
              <span
                key={index}
                className="block my-3 overflow-x-auto max-w-full text-center py-2 bg-gray-50/50 dark:bg-gray-900/40 rounded-lg border border-gray-100 dark:border-gray-800/50 px-4 scrollbar-thin"
                style={{ direction: 'ltr' }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          }

          return (
            <span
              key={index}
              className="inline-block px-1 font-sans"
              style={{ direction: 'ltr' }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch (error) {
          console.error('KaTeX rendering error:', error);
          return (
            <code key={index} className="text-xs bg-red-100/50 text-red-600 dark:bg-red-950/30 dark:text-red-400 px-1 py-0.5 rounded font-mono">
              {isBlock ? `$$${part.content}$$` : `$${part.content}$`}
            </code>
          );
        }
      })}
    </span>
  );
};
