import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import GroupMergedView from 'sentry/views/issueDetails/groupMerged';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';

interface MergedIssuesDataSectionProps {
  group: Group;
  project: Project;
}

export function MergedIssuesDataSection({project, group}: MergedIssuesDataSectionProps) {
  const organization = useOrganization();
  const location = useLocation();

  return (
    <FoldSection
      sectionKey={SectionKey.MERGED_ISSUES}
      title={t('Merged Issues')}
      initialCollapse
    >
      <GroupMergedView
        project={project}
        params={{
          groupId: group.id,
          orgId: organization.id,
        }}
        organization={organization}
        location={location}
      />
    </FoldSection>
  );
}
