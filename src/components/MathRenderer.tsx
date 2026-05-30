import React from 'react';
import katex from 'katex';

interface MathRendererProps {
  text: string;
  className?: string;
}

/**
 * Sanitizes and rewrites math expressions inside math blocks to correct common LaTeX formatting or
 * minor syntax errors made by AI models (e.g. translating 'frac' to 'fraction', omission of backslashes for Greek letters, etc.).
 */
function sanitizeMath(math: string): string {
  if (!math) return "";

  let cleaned = math;

  // 1. Correct writing of fractions (e.g. "fraction" or "frac" without a backslash, or wrong brackets)
  // Replace "fraction{a}{b}" or "frac{a}{b}" with "\frac{a}{b}"
  cleaned = cleaned.replace(/(?<!\\)\b(fraction|frac)\s*\{/g, '\\frac{');
  // Replace "\fraction{a}{b}" with "\frac{a}{b}"
  cleaned = cleaned.replace(/\\fraction\s*\{/g, '\\frac{');
  // Replace "fraction(a)(b)" or "\fraction(a)(b)" or "frac(a)(b)" or "\frac(a)(b)" with "\frac{a}{b}"
  cleaned = cleaned.replace(/\\?(?:fraction|frac)\s*\(([^)]+)\)\s*\(([^)]+)\)/g, '\\frac{$1}{$2}');

  // 2. Correct lowercase and uppercase Greek letters lacking backslashes (e.g. "beta" -> "\beta")
  const lowercaseGreek = 'alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|omicron|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega';
  const uppercaseGreek = 'Alpha|Beta|Gamma|Delta|Epsilon|Zeta|Eta|Theta|Iota|Kappa|Lambda|Mu|Nu|Xi|Omicron|Pi|Rho|Sigma|Tau|Upsilon|Phi|Chi|Psi|Omega';
  
  const greekRegexLower = new RegExp(`(?<!\\\\)\\b(${lowercaseGreek})\\b`, 'g');
  const greekRegexUpper = new RegExp(`(?<!\\\\)\\b(${uppercaseGreek})\\b`, 'g');

  cleaned = cleaned.replace(greekRegexLower, '\\$1');
  cleaned = cleaned.replace(greekRegexUpper, '\\$1');

  // 3. Fallback translations for misplaced French math phrases inside LaTeX context
  cleaned = cleaned.replace(/(?<!\\)\bsomme\b/gi, '\\sum');
  cleaned = cleaned.replace(/(?<!\\)\bproduit\b/gi, '\\prod');
  cleaned = cleaned.replace(/(?<!\\)\binfini\b/gi, '\\infty');

  return cleaned;
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
        const sanitizedFormula = sanitizeMath(part.content);

        try {
          const html = katex.renderToString(sanitizedFormula, {
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
              {isBlock ? `$$${sanitizedFormula}$$` : `$${sanitizedFormula}$`}
            </code>
          );
        }
      })}
    </span>
  );
};
