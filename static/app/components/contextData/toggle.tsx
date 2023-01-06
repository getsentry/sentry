import {Children, useState} from 'react';
import styled from '@emotion/styled';

import {IconAdd, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';

type Props = {
  children: React.ReactNode;
  highUp: boolean;
  wrapClassName: string;
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
        aria-label={isExpanded ? t('Collapse') : t('Expand')}
        isExpanded={isExpanded}
        onClick={evt => {
          setIsExpanded(!isExpanded);
          evt.preventDefault();
        }}
      >
        {isExpanded ? (
          <IconSubtract legacySize="10px" color="white" />
        ) : (
          <IconAdd legacySize="10px" color="white" />
        )}
      </IconWrapper>
      {isExpanded && wrappedChildren}
    </span>
  );
}

export default Toggle;

const IconWrapper = styled('div')<{isExpanded: boolean}>`
  border-radius: 2px;
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
