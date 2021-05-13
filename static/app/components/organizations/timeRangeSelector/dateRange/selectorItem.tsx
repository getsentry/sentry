import * as React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

type Props = {
  onClick: (value: string, e?: React.MouseEvent) => void;
  value: string;
  label: React.ReactNode;
  selected: boolean;
  last?: boolean;
  className?: string;
};

class SelectorItem extends React.PureComponent<Props> {
  handleClick = (e: React.MouseEvent) => {
    const {onClick, value} = this.props;
    onClick(value, e);
  };

  render() {
    const {className, label} = this.props;
    return (
      <div className={className} onClick={this.handleClick}>
        <Label>{label}</Label>
      </div>
    );
  }
}

const StyledSelectorItem = styled(SelectorItem)`
  display: flex;
  cursor: pointer;
  white-space: nowrap;
  padding: ${space(1)};
  align-items: center;
  flex: 1;
  background-color: ${p => (p.selected ? p.theme.active : 'transparent')};
  color: ${p => (p.selected ? p.theme.white : p.theme.subText)};
  font-weight: ${p => (p.selected ? 'bold' : 'normal')};
  border-bottom: 1px solid ${p => (p.last ? 'transparent' : p.theme.innerBorder)};

  &:hover {
    color: ${p => p.theme.textColor};
    background: ${p => p.theme.focus};
  }
`;

const Label = styled('span')`
  flex: 1;
  margin-right: ${space(1)};
`;

export default StyledSelectorItem;
