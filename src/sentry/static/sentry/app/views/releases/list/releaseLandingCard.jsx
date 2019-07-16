import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import space from 'app/styles/space';
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
    const {cardsLength, step} = this.props;
    if (step === 0) {
      return t('Tell Me More');
    } else if (step < cardsLength - 1) {
      return t('Next');
    } else {
      return t('See Docs for Setup');
    }
  };

  render() {
    const {card, cardsLength, step} = this.props;
    const CardComponent = card.component;
    const finalStep = step === cardsLength - 1;
    return (
      <Container>
        <IllustrationContainer>
          <CardComponentContainer>
            <CardComponent />
          </CardComponentContainer>
        </IllustrationContainer>

        <StyledBox>
          <h3>{card.title}</h3>
          <p>{card.message}</p>
          {finalStep ? (
            <Button
              href="https://docs.sentry.io/learn/releases/"
              onClick={this.props.onClick}
            >
              {this.getMessage()}
            </Button>
          ) : (
            <Button onClick={this.props.onClick}>{this.getMessage()}</Button>
          )}
        </StyledBox>
      </Container>
    );
  }
}

const Container = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 450px;
  padding: ${space(1)};
`;

const StyledBox = styled('div')`
  flex: 1;
  padding: 40px;
`;

const IllustrationContainer = styled(StyledBox)`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CardComponentContainer = styled('div')`
  width: 450px;

  img {
    vertical-align: baseline;
  }

  @media (max-width: 1150px) {
    font-size: 14px;
    width: 350px;
  }

  @media (max-width: 1000px) {
    font-size: 12px;
    width: 280px;
  }
`;

export default ReleaseLandingCard;
