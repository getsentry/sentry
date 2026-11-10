import type {ReactNode} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';

import {Feature} from 'sentry/components/acl/feature';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useInvestigationsEnabled} from 'sentry/views/investigations/utils';

function FeatureDisabledPage() {
  return (
    <Stack flex={1} padding="2xl 3xl">
      <FeatureDisabled
        features="organizations:investigations"
        featureName={t('Investigations')}
      />
    </Stack>
  );
}

function ClosedMembershipPage() {
  return (
    <Stack flex={1} padding="2xl 3xl">
      <Alert.Container>
        <Alert variant="warning">
          {t('Investigations are only available to organizations with open membership.')}
        </Alert>
      </Alert.Container>
    </Stack>
  );
}

export function InvestigationAccess({children}: {children: ReactNode}) {
  const organization = useOrganization();
  const investigationsEnabled = useInvestigationsEnabled();

  return (
    <Feature
      organization={organization}
      features="organizations:investigations"
      renderDisabled={() => <FeatureDisabledPage />}
    >
      {investigationsEnabled ? children : <ClosedMembershipPage />}
    </Feature>
  );
}
