import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {t, tct} from 'app/locale';
import {Config, Organization} from 'app/types';
import {analytics} from 'app/utils/analytics';
import withConfig from 'app/utils/withConfig';
import withOrganization from 'app/utils/withOrganization';

import {StepProps} from './types';

const recordAnalyticsOnboardingSkipped = ({organization}: {organization: Organization}) =>
  analytics('onboarding_v2.skipped', {org_id: organization.id});

type Props = StepProps & {
  organization: Organization;
  config: Config;
};

const OnboardingWelcome = ({organization, onComplete, config, active}: Props) => {
  const {user} = config;
  const skipOnboarding = () => recordAnalyticsOnboardingSkipped({organization});

  return (
    <React.Fragment>
      <p>
        {tct("We're happy you're here, [name]!", {
          name: <strong>{user.name.split(' ')[0]}</strong>,
        })}
      </p>
      <p>
        {t(
          `With Sentry, find and fix bugs and hunt down performance slowdowns
             before customers even notice a problem. When things go to hell
             we’ll help fight the fires. In the next two steps you will…`
        )}
      </p>
      <ul>
        <li>{t('Choose your platform.')}</li>
        <li>
          {t(
            `Integrate Sentry into your application, invite your team, or take
               a tour of Sentry.`
          )}
        </li>
      </ul>
      <ActionGroup>
        <Button
          data-test-id="welcome-next"
          disabled={!active}
          priority="primary"
          onClick={() => onComplete({})}
        >
          {t("I'm Ready!")}
        </Button>
        <SecondaryAction>
          {tct('Not your first Sentry rodeo? [exitLink:Skip this onboarding].', {
            exitLink: <Button priority="link" onClick={skipOnboarding} href="/" />,
          })}
        </SecondaryAction>
      </ActionGroup>
    </React.Fragment>
  );
};

const ActionGroup = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const SecondaryAction = styled('small')`
  color: ${p => p.theme.subText};
`;

export default withOrganization(withConfig(OnboardingWelcome));
