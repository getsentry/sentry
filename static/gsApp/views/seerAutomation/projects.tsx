import SeerProjectTable from 'getsentry/views/seerAutomation/components/projectTable/seerProjectTable';
import SeerSettingsPageWrapper from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';

export default function SeerAutomationProjects() {
  return (
    <SeerSettingsPageWrapper>
      <SeerProjectTable />
    </SeerSettingsPageWrapper>
  );
}
