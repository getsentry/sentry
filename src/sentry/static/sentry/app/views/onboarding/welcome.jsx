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
          {tct("We're happy you're here, [name]!", {
            name: <strong>{user.name.split(' ')[0]}</strong>,
          })}
        </p>
        <p>
          {t(
            `With Sentry, you can find and fix bugs before your customers even
             notice a problem. When things go to hell, we'll help you fight the
             fires. Let's get started!`
          )}
        </p>
        <ul>
          <li>{t('Choose your platform.')}</li>
          <li>
            {t(
              `Install and verify the integration of Sentry into your
               application by sending your first event.`
            )}
          </li>
        </ul>
        <ActionGroup>
          <Button disabled={!active} priority="primary" onClick={e => onComplete()}>
            {t("I'm Ready!")}
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
