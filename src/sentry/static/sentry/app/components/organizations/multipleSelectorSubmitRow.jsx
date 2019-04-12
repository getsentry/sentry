import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import Button from 'app/components/button';
import {growIn} from 'app/styles/animations';
import space from 'app/styles/space';
import {t} from 'app/locale';

class MultipleSelectorSubmitRow extends React.Component {
  static propTypes = {
    onSubmit: PropTypes.func,
  };

  render() {
    const {onSubmit} = this.props;

    return (
      <SubmitButtonContainer>
        <SubmitButton onClick={onSubmit} size="xsmall" priority="primary">
          {t('Apply')}
        </SubmitButton>
      </SubmitButtonContainer>
    );
  }
}

const SubmitButtonContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
`;

const SubmitButton = styled(Button)`
  animation: 0.1s ${growIn} ease-in;
  margin: ${space(0.5)} 0;
`;

export default MultipleSelectorSubmitRow;
