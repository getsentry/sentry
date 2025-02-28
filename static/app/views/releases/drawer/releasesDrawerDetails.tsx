import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Badge} from 'sentry/components/core/badge';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {CommitsFilesSection} from 'sentry/views/releases/drawer/commitsFilesSection';
import {DeploysCard} from 'sentry/views/releases/drawer/deploysCard';
import {FoldSection} from 'sentry/views/releases/drawer/foldSection';
import {GeneralCard} from 'sentry/views/releases/drawer/generalCard';
import {NewIssues} from 'sentry/views/releases/drawer/newIssues';
import {useReleaseMeta} from 'sentry/views/releases/utils/useReleaseMeta';

interface ReleasesDrawerDetailsProps {
  projectId: string | undefined;
  release: string;
}

export function ReleasesDrawerDetails({release, projectId}: ReleasesDrawerDetailsProps) {
  const {
    isLoading: isLoadingMeta,
    isError: isMetaError,
    data: releaseMeta,
  } = useReleaseMeta({release});
  const project = useProjectFromId({project_id: projectId});
  const projectSlug = project?.slug;

  if (!projectId || !projectSlug) {
    // TODO: Error handling... not sure when this would happen
    return <Alert type="error">{t('Project not found')}</Alert>;
  }

  return (
    <div>
      <FoldSection title={t('Details')} sectionKey={'details'}>
        <Details>
          <GeneralCard
            isMetaError={isMetaError}
            projectSlug={projectSlug}
            release={release}
            releaseMeta={releaseMeta}
          />

          <DeploysCard release={release} projectSlug={projectSlug} />
        </Details>
      </FoldSection>

      <CommitsFilesSection
        isLoadingMeta={isLoadingMeta}
        isMetaError={isMetaError}
        releaseMeta={releaseMeta}
        projectSlug={projectSlug}
        release={release}
      />

      <FoldSection
        sectionKey="issues"
        title={
          <TitleWithBadge>
            <span>{t('New Issues')}</span>
            <Badge type="default">
              {isLoadingMeta ? '-' : releaseMeta?.newGroups ?? '0'}
            </Badge>
          </TitleWithBadge>
        }
      >
        <NewIssues projectId={projectId} release={release} />
      </FoldSection>
    </div>
  );
}

const Details = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(3)};
  align-items: start;
`;
const TitleWithBadge = styled('div')`
  display: flex;
`;
