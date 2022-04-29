import {useEffect} from 'react';
import styled from '@emotion/styled';

import OnboardingPreview from 'sentry-images/spot/onboarding-preview.svg';

import Button from 'sentry/components/button';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import useApi from 'sentry/utils/useApi';

import {usePersistedOnboardingState} from './utils';

type Props = {
  organization: Organization;
};

export default function MobileRedirect({organization}: Props) {
  const client = useApi();
  const [clientState] = usePersistedOnboardingState();
  useEffect(() => {
    if (!clientState) {
      return;
    }
    if (clientState.mobileEmailSent) {
      // We've already sent the email once before
      return;
    }
    client.requestPromise(
      `/organizations/${organization.slug}/onboarding-continuation-email/`,
      {
        method: 'POST',
        data: {
          platforms: clientState.selectedPlatforms,
        },
      }
    );
  }, []);
  return (
    <Wrapper>
      <ActionImage src={OnboardingPreview} />
      <h3>{t('End of the line...for now')}</h3>
      <p>
        Once you are back at your computer, click the link in the email to finish
        onboarding.
      </p>
      <Button type="button" priority="primary" href="https://docs.sentry.io/">
        {t('Read up on Sentry')}
      </Button>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  text-align: center;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  justify-content: center;
  align-items: center;
  img {
    margin-bottom: ${space(4)};
  }
  h3 {
    margin-bottom: ${space(2)};
  }
  p {
    margin-bottom: ${space(4)};
  }
`;

const ActionImage = styled('img')`
  height: 182px;
`;
