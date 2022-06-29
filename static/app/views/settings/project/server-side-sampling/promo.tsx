import styled from '@emotion/styled';

import onboardingServerSideSampling from 'sentry-images/spot/onboarding-server-side-sampling.svg';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

import {SERVER_SIDE_DOC_LINK} from './utils';

export function Promo() {
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
          <Button priority="primary" onClick={() => {}}>
            {t('Get Started')}
          </Button>
        </Actions>
      </Description>
    </StyledEmptyStateWarning>
  );
}

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  padding: ${space(4)};
  display: flex;
  flex-wrap: wrap;

  align-items: center;
  justify-content: center;
  gap: ${space(4)};
  grid-column: 1/-1;
  text-align: left;

  img {
    width: 100%;
    max-width: 40%;
  }
`;

const Actions = styled(ButtonBar)`
  justify-content: flex-start;
`;

const Description = styled('div')`
  padding: 0 ${space(4)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    padding: ${space(4)};
  }
`;
