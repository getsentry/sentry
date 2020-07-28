import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import OnboardingPanel from 'app/components/onboardingPanel';
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
    const finalStep = step === cardsLength - 1;
    return (
      <OnboardingPanel image={card.svg}>
        <h3>{card.title}</h3>
        {card.disclaimer && <Disclaimer>{card.disclaimer}</Disclaimer>}
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
      </OnboardingPanel>
    );
  }
}

const Disclaimer = styled('div')`
  margin-top: -${space(3)};
  margin-bottom: ${space(2)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

export default ReleaseLandingCard;
