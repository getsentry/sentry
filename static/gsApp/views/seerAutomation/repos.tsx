import SeerRepoTable from 'getsentry/views/seerAutomation/components/repoTable/seerRepoTable';
import SeerSettingsPageWrapper from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';

export default function SeerAutomationRepos() {
  return (
    <SeerSettingsPageWrapper>
      <SeerRepoTable />
    </SeerSettingsPageWrapper>
  );
}
