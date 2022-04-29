import styled from '@emotion/styled';

import OnboardingPreview from 'sentry-images/spot/onboarding-preview.svg';

import Button from 'sentry/components/button';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

export default function MobileRedirect() {
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
