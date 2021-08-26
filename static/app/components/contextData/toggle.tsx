import {Children, useState} from 'react';
import styled from '@emotion/styled';

import {IconAdd, IconSubtract} from 'app/icons';

type Props = {
  highUp: boolean;
  wrapClassName: string;
  children: React.ReactNode;
};

function Toggle({highUp, wrapClassName, children}: Props) {
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
        isExpanded={isExpanded}
        onClick={evt => {
          setIsExpanded(!isExpanded);
          evt.preventDefault();
        }}
      >
        {isExpanded ? (
          <IconSubtract size="9px" color="white" />
        ) : (
          <IconAdd size="9px" color="white" />
        )}
      </IconWrapper>
      {isExpanded && wrappedChildren}
    </span>
  );
}

export default Toggle;

const IconWrapper = styled('div')<{isExpanded: boolean}>`
  border-radius: 2px;
  background: ${p => p.theme.white};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  ${p =>
    p.isExpanded
      ? `
          background: ${p.theme.gray300};
          border: 1px solid ${p.theme.gray300};
          &:hover {
            background: ${p.theme.gray400};
          }
        `
      : `
          background: ${p.theme.blue300};
          border: 1px solid ${p.theme.blue300};
          &:hover {
            background: ${p.theme.blue200};
          }
        `}
`;
