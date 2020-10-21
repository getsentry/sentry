import * as React from 'react';
import styled from '@emotion/styled';

import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';
import space from 'app/styles/space';

const defaultProps = {
  /**
   * This is a render prop which may be used to augment the checkbox rendered
   * to the right of the row. It will receive the default `checkbox` as a
   * prop along with the `checked` boolean.
   */
  renderCheckbox: (({checkbox}) => checkbox) as (options: {
    checkbox: React.ReactNode;
    checked?: boolean;
  }) => React.ReactNode,
  multi: true,
};

type Props = {
  checked: boolean;
  onCheckClick: (event: React.MouseEvent) => void;
  children: React.ReactNode;
} & typeof defaultProps;

class GlobalSelectionHeaderRow extends React.Component<Props> {
  static defaultProps = defaultProps;
  render() {
    const {checked, onCheckClick, multi, renderCheckbox, children, ...props} = this.props;

    const checkbox = <CheckboxFancy isDisabled={!multi} isChecked={checked} />;

    return (
      <Container isChecked={checked} {...props}>
        <Content multi={multi}>{children}</Content>
        <CheckboxHitbox onClick={multi ? onCheckClick : undefined}>
          {renderCheckbox({checkbox, checked})}
        </CheckboxHitbox>
      </Container>
    );
  }
}

const Container = styled('div')<{isChecked: boolean}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 400;
  padding-left: ${space(0.5)};
  height: ${p => p.theme.headerSelectorRowHeight}px;
  flex-shrink: 0;

  ${CheckboxFancy} {
    opacity: ${p => (p.isChecked ? 1 : 0.33)};
  }

  &:hover ${CheckboxFancy} {
    opacity: 1;
  }
`;

const Content = styled('div')<{multi: boolean}>`
  display: flex;
  flex-shrink: 1;
  overflow: hidden;
  align-items: center;
  height: 100%;
  flex-grow: 1;
  user-select: none;

  &:hover {
    text-decoration: ${p => (p.multi ? 'underline' : null)};
    color: ${p => (p.multi ? p.theme.blue400 : null)};
  }
`;

const CheckboxHitbox = styled('div')`
  margin: 0 -${space(1)} 0 0; /* pushes the click box to be flush with the edge of the menu */
  padding: 0 ${space(1.5)};
  height: 100%;
  display: flex;
  justify-content: flex-end;
  align-items: center;
`;

export default GlobalSelectionHeaderRow;
