import React from 'react';
import styled from '@emotion/styled';

type HighlightProps = {
  /**
   * The text to highlight
   */
  text: string;
  /**
   * Should highlighting be disabled?
   */
  disabled?: boolean;
  /**
   * The original text
   */
  children: string;
};

type Props = Omit<React.HTMLAttributes<HTMLDivElement>, keyof HighlightProps> &
  HighlightProps;

const HighlightComponent = ({className, children, disabled, text}: Props) => {
  if (!text || disabled) {
    return <React.Fragment>{children}</React.Fragment>;
  }

  const highlightText = text.toLowerCase();
  const idx = children.toLowerCase().indexOf(highlightText);

  if (idx === -1) {
    return <React.Fragment>{children}</React.Fragment>;
  }

  return (
    <React.Fragment>
      {children.substr(0, idx)}
      <span className={className}>{children.substr(idx, highlightText.length)}</span>
      {children.substr(idx + highlightText.length)}
    </React.Fragment>
  );
};

const Highlight = styled(HighlightComponent)`
  font-weight: normal;
  background-color: ${p => p.theme.yellowLight};
  color: ${p => p.theme.gray4};
`;

export default Highlight;
export {HighlightComponent};
