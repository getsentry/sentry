import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

import {usePersistedOnboardingState} from '../utils';

import GenericFooter from './genericFooter';

interface FirstEventFooterProps {
  onClickSetupLater: () => void;
  organization: Organization;
}

export default function FirstEventFooter({
  organization,
  onClickSetupLater,
}: FirstEventFooterProps) {
  const source = 'targeted_onboarding_setup_integrations_footer';
  const [clientState, setClientState] = usePersistedOnboardingState();

  return (
    <GridFooter>
      <SkipOnboardingLink
        onClick={() => {
          trackAdvancedAnalyticsEvent('growth.onboarding_clicked_skip', {
            organization,
            source,
          });
          if (clientState) {
            setClientState({
              ...clientState,
              state: 'skipped',
            });
          }
        }}
        to={`/organizations/${organization.slug}/issues/`}
      >
        {t('Skip Onboarding')}
      </SkipOnboardingLink>
      <div />
      <ButtonWrapper>
        <Button onClick={onClickSetupLater}>{t('Next')}</Button>
      </ButtonWrapper>
    </GridFooter>
  );
}

const ButtonWrapper = styled('div')`
  margin: ${space(2)} ${space(4)};
  justify-self: end;
  margin-left: auto;
`;

const SkipOnboardingLink = styled(Link)`
  margin: auto ${space(4)};
  white-space: nowrap;
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

const GridFooter = styled(GenericFooter)`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
    flex-direction: row;
    justify-content: end;
  }
`;
