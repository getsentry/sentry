import {Outlet} from 'react-router';

import {Stack} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {NoAccess} from 'sentry/components/noAccess';
import {AiFeaturesAreDisabledBanner} from 'sentry/components/seer/aiFeaturesAreDisabledBanner';
import {orgHasNewSeerPlan} from 'sentry/utils/seer/orgHasNewSeerPlan';
import {useOrganization} from 'sentry/utils/useOrganization';

export default function SeerAutomationRoot() {
  const organization = useOrganization();

  if (organization.hideAiFeatures) {
    return (
      <AnalyticsArea name="seer">
        <Stack gap="lg">
          {orgHasNewSeerPlan(organization) ? (
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
