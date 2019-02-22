import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import CheckboxFancy from 'app/components/checkboxFancy';
import space from 'app/styles/space';

export const VIRTUALIZED_HEIGHT = 40;

class DropdownAutoCompleteMultiRow extends React.Component {
  static propTypes = {
    checked: PropTypes.bool,
    noMultiFeature: PropTypes.bool,
    onCheckClick: PropTypes.func,
    children: PropTypes.node,
  };

  static defaultProps = {
    noMultiFeature: false,
  };

  render() {
    const {checked, onCheckClick, noMultiFeature, children, ...props} = this.props;

    return (
      <Container {...props}>
        <Content hasMultiFeature={!noMultiFeature}>{children}</Content>
        {!noMultiFeature && (
          <CheckboxWrapper onClick={onCheckClick} checked={checked}>
            <Checkbox checked={checked} />
          </CheckboxWrapper>
        )}
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
  padding-left: ${space(1)};
  height: ${VIRTUALIZED_HEIGHT}px;
  flex-shrink: 0;

  /* thanks bootstrap? */
  input[type='checkbox'] {
    margin: 0;
  }
`;

const Content = styled('div')`
  display: flex;
  flex-shrink: 1;
  padding-right: ${space(1)};
  overflow: hidden;
  align-items: center;
  height: 100%;
  flex-grow: 1;

  &:hover {
    text-decoration: ${p => (p.hasMultiFeature ? 'underline' : null)};
    color: ${p => (p.hasMultiFeature ? p.theme.blue : null)};
  }
`;

const Checkbox = styled(CheckboxFancy)`
  transition: 0.2s transform;
`;

const CheckboxWrapper = styled('div')`
  margin: -${space(1)}; /* pushes the click box to be flush with the edge of the menu */
  padding: 0 ${space(2)} 0 ${space(4)};
  height: 100%;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  transition: 0.2s all;

  &:hover ${Checkbox} {
    transform: scale(1.1);
    border-color: ${p => (p.checked ? p.theme.purple : p.theme.gray2)};
  }
`;

export default DropdownAutoCompleteMultiRow;
