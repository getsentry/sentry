import styled from '@emotion/styled';
import classNames from 'classnames';

import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Coverage} from 'sentry/types';

interface Props {
  isActive: boolean;
  lineNumber: number;
  children?: React.ReactNode;
  coverage?: Coverage | '';
}

const coverageText: Record<Coverage, string | undefined> = {
  [Coverage.NOT_COVERED]: t('Uncovered'),
  [Coverage.COVERED]: t('Covered'),
  [Coverage.PARTIAL]: t('Partially Covered'),
  [Coverage.NOT_APPLICABLE]: undefined,
};
const coverageClass: Record<Coverage, string | undefined> = {
  [Coverage.NOT_COVERED]: 'uncovered',
  [Coverage.COVERED]: 'covered',
  [Coverage.PARTIAL]: 'partial',
  [Coverage.NOT_APPLICABLE]: undefined,
};

function ContextLineNumber({lineNumber, isActive, coverage = ''}: Props) {
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
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
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
    border-right-style: solid;
    border-right-color: transparent;
    user-select: none;
  }

  &.covered .line-number {
    background: ${p => p.theme.green100};
  }

  &.uncovered .line-number {
    background: ${p => p.theme.red100};
    border-right-color: ${p => p.theme.red300};
  }

  &.partial .line-number {
    background: ${p => p.theme.yellow100};
    border-right-style: dashed;
    border-right-color: ${p => p.theme.yellow300};
  }

  &.active {
    background: none;
  }

  &.active.partial .line-number {
    mix-blend-mode: screen;
    background: ${p => p.theme.yellow200};
  }

  &.active.covered .line-number {
    mix-blend-mode: screen;
    background: ${p => p.theme.green200};
  }

  &.active.uncovered .line-number {
    color: ${p => p.theme.stacktraceActiveText};
    mix-blend-mode: screen;
    background: ${p => p.theme.red300};
  }
`;
