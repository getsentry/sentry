import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {Box} from 'grid-emotion';
import {t} from 'app/locale';

import Button from 'app/components/button';

class ReleaseLandingCard extends React.Component {
  static propTypes = {
    card: PropTypes.object.isRequired,
    cardsLength: PropTypes.number.isRequired,
    step: PropTypes.number.isRequired,
    onClick: PropTypes.func.isRequired,
  };

  getMessage = () => {
    let {cardsLength, step} = this.props;
    if (step == 0) {
      return t('Tell Me More');
    } else if (step < cardsLength - 1) {
      return t('Next');
    } else {
      return t('See Docs for Setup');
    }
  };

  render() {
    let {card, cardsLength, step} = this.props;
    let CardComponent = card.component;
    let finalStep = step === cardsLength - 1;
    return (
      <div className="row">
        <div className="col-md-6">
          <StyledBox>
            <CardComponent />
          </StyledBox>
        </div>

        <div className="col-md-6">
          <StyledBox>
            <h3>{card.title}</h3>
            <p>{card.message}</p>
            {finalStep ? (
              <StyledButton
                href={'https://docs.sentry.io/learn/releases/'}
                onClick={this.props.onClick}
              >
                {this.getMessage()}
              </StyledButton>
            ) : (
              <StyledButton onClick={this.props.onClick}>
                {this.getMessage()}
              </StyledButton>
            )}
          </StyledBox>
        </div>
      </div>
    );
  }
}

const StyledBox = styled(Box)`
  padding: 80px;
  align-items: center;
`;

const StyledButton = styled(Button)`
  align-items: left;
`;
export default ReleaseLandingCard;
