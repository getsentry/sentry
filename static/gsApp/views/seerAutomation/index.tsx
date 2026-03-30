import {Outlet} from 'react-router-dom';

import {Stack} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {NoAccess} from 'sentry/components/noAccess';
import {useOrganization} from 'sentry/utils/useOrganization';

import {AiFeaturesAreDisabledBanner} from 'getsentry/views/seerAutomation/components/aiFeaturesAreDisabledBanner';

export default function SeerAutomationRoot() {
  const organization = useOrganization();

  if (organization.hideAiFeatures) {
    return (
      <AnalyticsArea name="seer">
        <Stack gap="lg">
          {organization.features.includes('seat-based-seer-enabled') ? (
            <AiFeaturesAreDisabledBanner />
          ) : (
            <NoAccess />
          )}
        </Stack>
      </AnalyticsArea>
    );
  }

  return (
    <AnalyticsArea name="seer">
      <Outlet />
    </AnalyticsArea>
  );
}
