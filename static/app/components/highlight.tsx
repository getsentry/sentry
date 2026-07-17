import {Fragment, useMemo} from 'react';

interface MultiHighlightProps {
  /**
   * The original text
   */
  children: string;
  /**
   * The terms to highlight
   */
  terms: string[];
  /**
   * Whether to only highlight text that matches case too
   */
  caseSensitive?: boolean;
  className?: string;
  /**
   * Should highlighting be disabled?
   */
  disabled?: boolean;
}

export function MultiHighlight({
  caseSensitive,
  className,
  children,
  disabled,
  terms,
}: MultiHighlightProps) {
  const {validTerms, pattern} = useMemo(() => {
    // Longer terms first so an overlapping shorter term can't win the alternation.
    const sorted = terms.filter(Boolean).sort((a, b) => b.length - a.length);
    if (sorted.length === 0) {
      return {validTerms: sorted, pattern: null};
    }
    const escaped = sorted.map(term => RegExp.escape(term));
    return {
      validTerms: sorted,
      pattern: new RegExp(`(${escaped.join('|')})`, caseSensitive ? 'g' : 'gi'),
    };
  }, [terms, caseSensitive]);

  if (disabled || !pattern || typeof children !== 'string') {
    return children;
  }

  const parts = children.split(pattern);
  if (parts.length === 1) {
    return children;
  }

  const isMatch = (part: string) =>
    validTerms.some(term =>
      caseSensitive ? part === term : part.toLowerCase() === term.toLowerCase()
    );

  return (
    <Fragment>
      {parts.map((part, index) =>
        isMatch(part) ? (
          <span key={index} className={className}>
            {part}
          </span>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        )
      )}
    </Fragment>
  );
}
