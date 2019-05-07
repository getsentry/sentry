import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t, tct} from 'app/locale';
import Button from 'app/components/button';
import SentryTypes from 'app/sentryTypes';
import withConfig from 'app/utils/withConfig';

class OnboardingWelcome extends React.Component {
  static propTypes = {
    active: PropTypes.bool.isRequired,
    onComplete: PropTypes.func.isRequired,
    config: SentryTypes.Config.isRequired,
  };

  render() {
    const {onComplete, config, active} = this.props;
    const {user} = config;

    return (
      <React.Fragment>
        <p>
          {tct('Welcome to Sentry [name]!', {
            name: <strong>{user.name.split(' ')[0]}</strong>,
          })}
        </p>
        <p>
          {t(
            `Lets take a moment to get you familiar with some concepts in
             Sentry and set your account up with a few things along the way. At
             the end of this short (we promise!) onboarding, you'll be ready to
             integrate Sentry into your application and start saving yourself
             hours of headaches debugging errors.`
          )}
        </p>
        <ActionGroup>
          <Button disabled={!active} priority="primary" onClick={e => onComplete()}>
            {t('Lets set this up!')}
          </Button>
          <SecondaryAction>
            {tct('Not your first Sentry rodeo? [exitLink:Skip this onboarding].', {
              exitLink: <Button priority="link" to="/" />,
            })}
          </SecondaryAction>
        </ActionGroup>
      </React.Fragment>
    );
  }
}

const ActionGroup = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const SecondaryAction = styled('small')`
  color: ${p => p.theme.gray3};
`;

export default withConfig(OnboardingWelcome);
