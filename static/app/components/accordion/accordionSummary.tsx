import {useState} from 'react';
import styled from '@emotion/styled';

import {IconChevron} from 'sentry/icons';

export interface AccordionSummaryProps extends React.HTMLAttributes<HTMLDivElement> {
  onClick: () => void;
  disabled?: boolean;
}

function AccordionSummary({onClick, disabled = false, children}: AccordionSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  function handleClick() {
    if (disabled) {
      return;
    }
    setIsExpanded(!isExpanded);
    onClick();
  }

  return (
    <Summary onClick={handleClick} disabled={disabled}>
      {children}
      {!disabled && <IconChevron direction={isExpanded ? 'up' : 'down'} size="sm" />}
    </Summary>
  );
}

const Summary = styled('div')<{disabled: boolean}>`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: ${props => (props.disabled ? 'auto' : 'pointer')};
`;

export default AccordionSummary;
