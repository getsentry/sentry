import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';
import {Box} from 'grid-emotion';

import Button from 'app/components/button';

const ReleaseLandingCard = createReactClass({
  displayName: 'ReleaseLandingCard',

  propTypes: {
    card: PropTypes.object.isRequired,
    step: PropTypes.number.isRequired,
    onClick: PropTypes.func.isRequired,
  },

  getMessage() {
    let {step} = this.props;
    if (step == 0) {
      return 'Tell Me More';
    } else if (step < 4) {
      return 'Next';
    } else {
      return 'See Docs for Setup';
    }
  },

  render() {
    let {card} = this.props;
    let CardComponent = card.component;
    return (
      <div className="row">
        <div className="col-md-6">
          <StyledBox className="align-center">
            <CardComponent />
          </StyledBox>
        </div>

        <div className="col-md-6">
          <StyledBox className="align-left">
            <h3> {card.title}</h3>
            <p> {card.message}</p>
            <div className="align-left">
              <Button
                href={this.props.step === 4 && 'https://docs.sentry.io/learn/releases/'}
                onClick={this.props.onClick}
              >
                {this.getMessage()}
              </Button>
            </div>
          </StyledBox>
        </div>
      </div>
    );
  },
});

const StyledBox = styled(Box)`
  padding: 80px;
  align-items: center;
`;
export default ReleaseLandingCard;
