import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import CheckboxFancy from 'app/components/checkboxFancy';
import space from 'app/styles/space';

class GlobalSelectionHeaderRow extends React.Component {
  static propTypes = {
    checked: PropTypes.bool.isRequired,
    multi: PropTypes.bool,
    onCheckClick: PropTypes.func.isRequired,
    children: PropTypes.node.isRequired,
  };

  static defaultProps = {
    multi: true,
  };

  render() {
    const {checked, onCheckClick, multi, children, ...props} = this.props;

    return (
      <Container isMulti={multi} isChecked={checked} {...props}>
        <Content multi={multi}>{children}</Content>
        <CheckboxWrapper onClick={multi ? onCheckClick : null} checked={checked}>
          <CheckboxFancy disabled={!multi} checked={multi && checked} />
        </CheckboxWrapper>
      </Container>
    );
  }
}

const Container = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 400;
  padding-left: ${space(0.5)};
  height: ${p => p.theme.headerSelectorRowHeight}px;
  flex-shrink: 0;

  /* stylelint-disable-next-line no-duplicate-selectors */
  ${CheckboxFancy} {
    opacity: ${p => (p.isMulti && p.isChecked ? 1 : 0.33)};
  }

  &:hover ${CheckboxFancy} {
    opacity: 1;
  }
`;

const Content = styled('div')`
  display: flex;
  flex-shrink: 1;
  overflow: hidden;
  align-items: center;
  height: 100%;
  flex-grow: 1;
  user-select: none;

  &:hover {
    text-decoration: ${p => (p.multi ? 'underline' : null)};
    color: ${p => (p.multi ? p.theme.blue : null)};
  }
`;

const CheckboxWrapper = styled('div')`
  margin: 0 -${space(1)} 0 0; /* pushes the click box to be flush with the edge of the menu */
  padding: 0 ${space(1.5)} 0 ${space(1.25)};
  height: 100%;
  display: flex;
  justify-content: flex-end;
  align-items: center;
`;

export default GlobalSelectionHeaderRow;
