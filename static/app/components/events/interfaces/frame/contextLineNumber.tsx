import styled from '@emotion/styled';
import classNames from 'classnames';

import {Tooltip} from 'sentry/components/core/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Coverage} from 'sentry/types/integrations';

interface Props {
  isActive: boolean;
  lineNumber: number;
  children?: React.ReactNode;
  coverage?: Coverage;
}

export const coverageText: Record<Coverage, string | undefined> = {
  [Coverage.NOT_COVERED]: t('Line uncovered by tests'),
  [Coverage.COVERED]: t('Line covered by tests'),
  [Coverage.PARTIAL]: t('Line partially covered by tests'),
  [Coverage.NOT_APPLICABLE]: undefined,
};
const coverageClass: Record<Coverage, string | undefined> = {
  [Coverage.NOT_COVERED]: 'uncovered',
  [Coverage.COVERED]: 'covered',
  [Coverage.PARTIAL]: 'partial',
  [Coverage.NOT_APPLICABLE]: undefined,
};

function ContextLineNumber({
  lineNumber,
  isActive,
  coverage = Coverage.NOT_APPLICABLE,
}: Props) {
  return (
    <Wrapper className={classNames(coverageClass[coverage], isActive ? 'active' : '')}>
      <Tooltip skipWrapper title={coverageText[coverage]} delay={200}>
        <div className="line-number">{lineNumber}</div>
      </Tooltip>
    </Wrapper>
  );
}

export default ContextLineNumber;

const Wrapper = styled('div')`
  background: inherit;
  height: 24px;
  width: 58px;
  display: inline-block;
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.fontSize.sm};
  margin-right: ${space(1)};

  .line-number {
    display: flex;
    align-items: center;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: end;
    height: 100%;
    text-align: right;
    padding-right: ${space(2)};
    margin-right: ${space(1.5)};
    background: transparent;
    min-width: 58px;
    border-right: 3px solid transparent;
    user-select: none;
  }

  &.covered .line-number {
    background: ${p => p.theme.colors.green100};
    border-right: 3px solid ${p => p.theme.tokens.border.success};
  }

  &.uncovered .line-number {
    background: ${p => p.theme.colors.red100};
    border-right: 3px solid ${p => p.theme.tokens.border.danger};
  }

  &.partial .line-number {
    background: ${p => p.theme.colors.yellow100};
    border-right: 3px dashed ${p => p.theme.tokens.border.warning};
  }

  &.active {
    background: none;
  }

  &.active.partial .line-number {
    mix-blend-mode: screen;
    background: ${p => p.theme.colors.yellow200};
  }

  &.active.covered .line-number {
    mix-blend-mode: screen;
    background: ${p => p.theme.colors.green200};
  }

  &.active.uncovered .line-number {
    color: ${p => p.theme.colors.white};
    mix-blend-mode: screen;
    background: ${p => p.theme.colors.red400};
  }
`;
