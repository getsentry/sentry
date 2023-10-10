import {Fragment} from 'react';
import styled from '@emotion/styled';

type HighlightProps = {
  /**
   * The original text
   */
  children: string;
  /**
   * The text to highlight
   */
  text: string;
  /**
   * Should highlighting be disabled?
   */
  disabled?: boolean;
};

type Props = Omit<React.HTMLAttributes<HTMLDivElement>, keyof HighlightProps> &
  HighlightProps;

function HighlightComponent({className, children, disabled, text}: Props) {
  // There are instances when children is not string in breadcrumbs but not caught by TS
  if (!text || disabled || typeof children !== 'string') {
    return <Fragment>{children}</Fragment>;
  }

  const highlightText = text.toLowerCase();
  const idx = children.toLowerCase().indexOf(highlightText);

  if (idx === -1) {
    return <Fragment>{children}</Fragment>;
  }

  return (
    <Fragment>
      {children.substring(0, idx)}
      <span className={className}>
        {children.substring(idx, idx + highlightText.length)}
      </span>
      {children.substring(idx + highlightText.length)}
    </Fragment>
  );
}

const Highlight = styled(HighlightComponent)`
  font-weight: normal;
  background-color: ${p => p.theme.yellow200};
  color: ${p => p.theme.textColor};
`;

export default Highlight;
export {HighlightComponent};
