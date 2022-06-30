import styled from '@emotion/styled';

import onboardingServerSideSampling from 'sentry-images/spot/onboarding-server-side-sampling.svg';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

import {SERVER_SIDE_DOC_LINK} from './utils';

type Props = {
  hasAccess: boolean;
  onGetStarted: () => void;
};

export function Promo({onGetStarted, hasAccess}: Props) {
  return (
    <StyledEmptyStateWarning withIcon={false}>
      <img src={onboardingServerSideSampling} />
      <Description>
        <h3>{t('No sampling rules active yet')}</h3>
        <p>{t('Set up your project for sampling success')}</p>
        <Actions gap={1}>
          <Button href={SERVER_SIDE_DOC_LINK} external>
            {t('Read Docs')}
          </Button>
          <Button
            priority="primary"
            onClick={onGetStarted}
            disabled={!hasAccess}
            title={
              hasAccess
                ? undefined
                : t('You do not have permission to set up the sampling rules.')
            }
          >
            {t('Get Started')}
          </Button>
        </Actions>
      </Description>
    </StyledEmptyStateWarning>
  );
}

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: ${space(4)};
  grid-column: 1/-1;
  text-align: center;

  img {
    width: 320px;
  }

  && {
    display: flex;
    padding: ${space(4)};
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    text-align: left;
    flex-direction: row;
    img {
      width: 100%;
      max-width: 40%;
      min-width: 320px;
    }
  }
`;

const Actions = styled(ButtonBar)`
  justify-content: center;

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    justify-content: flex-start;
  }
`;

const Description = styled('div')`
  justify-content: space-between;

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    padding: ${space(4)};
    justify-content: flex-start;
  }
`;
