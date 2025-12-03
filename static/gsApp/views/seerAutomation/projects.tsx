import SeerProjectTable from 'getsentry/views/seerAutomation/components/projectTable/seerProjectTable';
import {SeerAutomationProjectList} from 'getsentry/views/seerAutomation/components/seerAutomationProjectList';
import SeerSettingsPageWrapper from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';

export default function SeerAutomationProjects() {
  return (
    <SeerSettingsPageWrapper>
      <SeerProjectTable />
      <SeerAutomationProjectList />
    </SeerSettingsPageWrapper>
  );
}
