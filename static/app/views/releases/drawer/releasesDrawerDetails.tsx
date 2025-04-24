import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Badge} from 'sentry/components/core/badge';
import {LinkButton} from 'sentry/components/core/button';
import {
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  Header,
  NavigationCrumbs,
} from 'sentry/components/events/eventDrawer';
import Link from 'sentry/components/links/link';
import {PlatformList} from 'sentry/components/platformList';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {CommitsFilesSection} from 'sentry/views/releases/drawer/commitsFilesSection';
import {DeploysCard} from 'sentry/views/releases/drawer/deploysCard';
import {FoldSection, SectionDivider} from 'sentry/views/releases/drawer/foldSection';
import {GeneralCard} from 'sentry/views/releases/drawer/generalCard';
import {NewIssues} from 'sentry/views/releases/drawer/newIssues';
import {ReleasesDrawerFields} from 'sentry/views/releases/drawer/utils';
import {makeReleasesPathname} from 'sentry/views/releases/utils/pathnames';
import {useReleaseDetails} from 'sentry/views/releases/utils/useReleaseDetails';
import {useReleaseMeta} from 'sentry/views/releases/utils/useReleaseMeta';

interface ReleasesDrawerDetailsProps {
  projectId: string | undefined;
  release: string;
}

export function ReleasesDrawerDetails({
  release,
  projectId: projectIdParam,
}: ReleasesDrawerDetailsProps) {
  const {
    isLoading: isLoadingMeta,
    isError: isMetaError,
    data: releaseMeta,
  } = useReleaseMeta({release});
  const location = useLocation();
  const organization = useOrganization();
  const releaseDetailsQuery = useReleaseDetails({release});

  // TODO: Handle the case when there are multiple projects
  const projectId =
    projectIdParam ||
    (releaseMeta?.projects[0]?.id ? String(releaseMeta?.projects[0]?.id) : undefined);

  // projectId can come from url or from the release meta
  const project = useProjectFromId({
    project_id: projectId,
  });
  const projectSlug = project?.slug;
  const {
    [ReleasesDrawerFields.RELEASE]: _release,
    [ReleasesDrawerFields.RELEASE_PROJECT_ID]: _releaseProjectId,
    ...locationQueryWithoutRelease
  } = location.query;

  const crumbs = [
    {
      label: (
        <Link
          to={{
            query: locationQueryWithoutRelease,
          }}
        >
          {t('Releases')}
        </Link>
      ),
    },
    {label: formatVersion(release)},
  ];

  if (!projectSlug) {
    return (
      <EventDrawerContainer>
        <EventDrawerHeader>
          <NavigationCrumbs crumbs={crumbs} />
        </EventDrawerHeader>
        <EventDrawerBody>
          <Alert type="error">{t('Project not found')}</Alert>
        </EventDrawerBody>
      </EventDrawerContainer>
    );
  }

  return (
    <EventDrawerContainer>
      <EventDrawerHeader>
        <NavigationCrumbs crumbs={crumbs} />
      </EventDrawerHeader>
      <EventNavigator>
        <HeaderToolbar>
          <ReleaseWithPlatform>
            <PlatformList
              platforms={releaseDetailsQuery.data?.projects.map(({platform}) => platform)}
            />
            {formatVersion(release)}
          </ReleaseWithPlatform>

          <LinkButton
            to={normalizeUrl({
              pathname: makeReleasesPathname({
                path: `/${encodeURIComponent(release)}/`,
                organization,
              }),
              query: {
                project: projectId,
              },
            })}
            size="xs"
            onClick={() => {
              trackAnalytics('releases.drawer_view_full_details', {
                organization: organization.id,
                project_id: String(projectId),
              });
            }}
          >
            {t('View Full Details')}
          </LinkButton>
        </HeaderToolbar>
      </EventNavigator>
      <EventDrawerBody>
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
          <SectionDivider />

          <FoldSection
            sectionKey="issues"
            title={
              <TitleWithBadge>
                <span>{t('New Issues')}</span>
                <Badge type="default">
                  {isLoadingMeta ? '-' : (releaseMeta?.newGroups ?? '0')}
                </Badge>
              </TitleWithBadge>
            }
          >
            <NewIssues projectId={projectId} release={release} />
          </FoldSection>
        </div>
      </EventDrawerBody>
    </EventDrawerContainer>
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

const ReleaseWithPlatform = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const HeaderToolbar = styled(Header)`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;
