import {Children, useState} from 'react';
import styled from '@emotion/styled';

import {IconAdd, IconSubtract} from 'app/icons';

type Props = {
  highUp: boolean;
  wrapClassName: string;
  children: React.ReactNode;
  onClick?: () => void;
};

function Toggle({highUp, wrapClassName, onClick, children}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (Children.count(children) === 0) {
    return null;
  }

  const wrappedChildren = <span className={wrapClassName}>{children}</span>;

  if (highUp) {
    return wrappedChildren;
  }

  return (
    <span>
      <IconWrapper
        onClick={evt => {
          setIsExpanded(!isExpanded);
          onClick?.();
          evt.preventDefault();
        }}
      >
        {isExpanded ? (
          <IconSubtract size="9px" color="gray300" />
        ) : (
          <IconAdd size="9px" color="blue300" />
        )}
      </IconWrapper>
      {isExpanded && wrappedChildren}
    </span>
  );
}

export default Toggle;

const IconWrapper = styled('div')`
  border-radius: 2px;
  background: ${p => p.theme.white};
  border: 1px solid ${p => p.theme.border};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;
