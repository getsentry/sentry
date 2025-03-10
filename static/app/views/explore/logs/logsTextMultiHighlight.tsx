import {Fragment} from 'react';
import styled from '@emotion/styled';

type HighlightProps = {
  /**
   * The original text
   */
  children: string;
  /**
   * The terms to highlight
   */
  terms: string[];
  /**
   * Should highlighting be disabled?
   */
  disabled?: boolean;
};

type Props = Omit<React.HTMLAttributes<HTMLDivElement>, keyof HighlightProps> &
  HighlightProps;

function _LogsTextMultiHighlight({className, children, disabled, terms}: Props) {
  // There are instances when children is not string in breadcrumbs but not caught by TS
  if (!terms?.length || disabled || typeof children !== 'string') {
    return <Fragment>{children}</Fragment>;
  }

  const validTerms = terms.filter(Boolean);
  if (validTerms.length === 0) {
    return <Fragment>{children}</Fragment>;
  }

  // TODO: Replace with 'RegExp.escape' when it's available.
  const escapedTerms = validTerms.map(term =>
    term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );

  const pattern = new RegExp(`(${escapedTerms.join('|')})`, 'gi');

  // Split the text by the pattern
  const parts = children.split(pattern);

  if (parts.length === 1) {
    // No matches found
    return <Fragment>{children}</Fragment>;
  }

  // Build the result with highlighted sections
  const result = parts.map((part, index) => {
    // Check if this part matches any of the terms (case-insensitive)
    const isMatch = validTerms.some(term => part.toLowerCase() === term.toLowerCase());

    if (isMatch) {
      return (
        <span key={index} className={className}>
          {part}
        </span>
      );
    }

    return part;
  });

  return <Fragment>{result}</Fragment>;
}

const LogsTextMultiHighlight = styled(_LogsTextMultiHighlight)`
  font-weight: ${p => p.theme.fontWeightBold};
  background-color: ${p => p.theme.gray200};
  margin-right: 1px;
  margin-left: 1px;
  padding-right: 1px;
  padding-left: 1px;
`;

export default LogsTextMultiHighlight;
