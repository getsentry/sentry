import AnalyticsArea from 'sentry/components/analyticsArea';

import SeerProjectTable from 'getsentry/views/seerAutomation/components/projectTable/seerProjectTable';
import SeerSettingsPageWrapper from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';

export default function SeerAutomationProjects() {
  return (
    <AnalyticsArea name="projects">
      <SeerSettingsPageWrapper>
        <SeerProjectTable />
      </SeerSettingsPageWrapper>
    </AnalyticsArea>
  );
}
