import AnalyticsArea from 'sentry/components/analyticsArea';

import SeerRepoTable from 'getsentry/views/seerAutomation/components/repoTable/seerRepoTable';
import SeerSettingsPageWrapper from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';

export default function SeerAutomationRepos() {
  return (
    <AnalyticsArea name="repos">
      <SeerSettingsPageWrapper>
        <SeerRepoTable />
      </SeerSettingsPageWrapper>
    </AnalyticsArea>
  );
}
