import styled from '@emotion/styled';

import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';

interface Props {
  isActive: boolean;
  lineNumber: number;
  children?: React.ReactNode;
}

export function ContextLineNumber({lineNumber, isActive}: Props) {
  return (
    <Wrapper className={isActive ? 'active' : ''}>
      <div className="line-number">
        {lineNumber}
        {isActive && (
          <ActiveLineMarker
            direction="right"
            size="xs"
            aria-label={t('Current frame line')}
          />
        )}
      </div>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  background: inherit;
  height: 24px;
  width: 58px;
  display: inline-block;
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.sm};
  margin-right: ${p => p.theme.space.md};

  .line-number {
    position: relative;
    display: flex;
    align-items: center;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: end;
    height: 100%;
    text-align: right;
    padding-right: ${p => p.theme.space.xl};
    margin-right: ${p => p.theme.space.lg};
    background: transparent;
    min-width: 58px;
    border-right: 3px solid transparent;
    user-select: none;
  }

  &.active {
    background: none;
  }
`;

const ActiveLineMarker = styled(IconArrow)`
  position: absolute;
  right: ${p => p.theme.space.xs};
`;
