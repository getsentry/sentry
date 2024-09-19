import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import GroupSimilarIssues from 'sentry/views/issueDetails/groupSimilarIssues';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';

interface SimilarIssuesDataSectionProps {
  group: Group;
  project: Project;
}

export function SimilarIssuesDataSection({
  project,
  group,
}: SimilarIssuesDataSectionProps) {
  const organization = useOrganization();
  const location = useLocation();

  return (
    <FoldSection
      sectionKey={SectionKey.SIMILAR_ISSUES}
      title={t('Similar Issues')}
      initialCollapse
    >
      <GroupSimilarIssues
        location={location}
        params={{
          groupId: group.id,
          orgId: organization.id,
        }}
        project={project}
      />
    </FoldSection>
  );
}
