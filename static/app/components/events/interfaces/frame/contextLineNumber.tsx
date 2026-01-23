import styled from '@emotion/styled';
import classNames from 'classnames';

import {space} from 'sentry/styles/space';

interface Props {
  isActive: boolean;
  lineNumber: number;
  children?: React.ReactNode;
}

function ContextLineNumber({lineNumber, isActive}: Props) {
  return (
    <Wrapper className={classNames(isActive ? 'active' : '')}>
      <div className="line-number">{lineNumber}</div>
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
  font-size: ${p => p.theme.font.size.sm};
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

  &.active {
    background: none;
  }
`;
