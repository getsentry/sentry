import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import pick from 'lodash/pick';

import {SectionHeading} from 'sentry/components/charts/styles';
import {DateTime} from 'sentry/components/dateTime';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingError from 'sentry/components/loadingError';
import Placeholder from 'sentry/components/placeholder';
import TextOverflow from 'sentry/components/textOverflow';
import Version from 'sentry/components/version';
import {URL_PARAM} from 'sentry/constants/pageFilters';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {Release} from 'sentry/types/release';
import {useApiQuery} from 'sentry/utils/queryClient';
import {makeReleasesPathname} from 'sentry/views/releases/utils/pathnames';

import MissingReleasesButtons from './missingFeatureButtons/missingReleasesButtons';
import {SectionHeadingLink, SectionHeadingWrapper, SidebarSection} from './styles';

const PLACEHOLDER_AND_EMPTY_HEIGHT = '160px';

type Props = {
  isProjectStabilized: boolean;
  location: Location;
  organization: Organization;
  projectSlug: string;
  project?: Project;
};

type BodyProps = {
  isError: boolean;
  isLoading: boolean;
  isProjectStabilized: boolean;
  organization: Organization;
  project: Project | undefined;
  releases: Release[] | null;
};

function useHasOlderReleases({
  releases,
  releasesLoading,
  organization,
  project,
  isProjectStabilized,
}: {
  isProjectStabilized: boolean;
  organization: Organization;
  project: Project | undefined;
  releases: Release[] | null;
  releasesLoading: boolean;
}) {
  const skipOldReleaseCheck =
    releasesLoading ||
    (releases ?? []).length !== 0 ||
    !project?.id ||
    !isProjectStabilized;

  const {data: olderReleases, isPending} = useApiQuery<Release[]>(
    [
      `/organizations/${organization.slug}/releases/stats/`,
      {
        query: {
          statsPeriod: '90d',
          project: project?.id,
          per_page: 1,
        },
      },
    ],
    {staleTime: 0, enabled: !skipOldReleaseCheck}
  );

  if (skipOldReleaseCheck) {
    return true;
  }

  if (isPending) {
    return null;
  }

  return (olderReleases?.length ?? 0) > 0;
}

function ReleasesBody({
  organization,
  project,
  isProjectStabilized,
  releases,
  isLoading,
  isError,
}: BodyProps) {
  const hasOlderReleases = useHasOlderReleases({
    organization,
    project,
    releases,
    releasesLoading: isLoading,
    isProjectStabilized,
  });
  const checkingForOlderReleases = !(releases ?? []).length && hasOlderReleases === null;
  const showLoadingIndicator =
    isLoading || checkingForOlderReleases || !isProjectStabilized;

  if (isError) {
    return <LoadingError />;
  }

  if (showLoadingIndicator) {
    return <Placeholder height={PLACEHOLDER_AND_EMPTY_HEIGHT} />;
  }

  if (!hasOlderReleases) {
    return (
      <MissingReleasesButtons
        organization={organization}
        projectId={project?.id}
        platform={project?.platform}
      />
    );
  }

  if (!releases || releases.length === 0) {
    return (
      <StyledEmptyStateWarning small>{t('No releases found')}</StyledEmptyStateWarning>
    );
  }

  return (
    <ReleasesTable>
      {releases.map(release => (
        <Fragment key={release.version}>
          <DateTime
            date={release.lastDeploy?.dateFinished || release.dateCreated}
            seconds={false}
          />
          <TextOverflow>
            <StyledVersion
              version={release.version}
              tooltipRawVersion
              projectId={project?.id}
            />
          </TextOverflow>
        </Fragment>
      ))}
    </ReleasesTable>
  );
}

function ProjectLatestReleases({
  isProjectStabilized,
  location,
  organization,
  projectSlug,
  project,
}: Props) {
  const {
    data: releases = null,
    isLoading,
    isError,
  } = useApiQuery<Release[]>(
    [
      `/projects/${organization.slug}/${projectSlug}/releases/`,
      {
        query: {
          ...pick(location.query, Object.values(URL_PARAM)),
          per_page: 5,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: isProjectStabilized,
    }
  );

  return (
    <SidebarSection>
      <SectionHeadingWrapper>
        <SectionHeading>{t('Latest Releases')}</SectionHeading>
        <SectionHeadingLink
          to={{
            pathname: makeReleasesPathname({
              organization,
              path: '/',
            }),
            query: {
              statsPeriod: undefined,
              start: undefined,
              end: undefined,
              utc: undefined,
            },
          }}
        >
          <IconOpen />
        </SectionHeadingLink>
      </SectionHeadingWrapper>
      <div>
        <ReleasesBody
          organization={organization}
          project={project}
          isProjectStabilized={isProjectStabilized}
          releases={releases}
          isLoading={isLoading}
          isError={isError}
        />
      </div>
    </SidebarSection>
  );
}

const ReleasesTable = styled('div')`
  display: grid;
  font-size: ${p => p.theme.fontSize.md};
  white-space: nowrap;
  grid-template-columns: 1fr auto;
  margin-bottom: ${space(2)};

  & > * {
    padding: ${space(0.5)} ${space(1)};
    height: 32px;
  }

  & > *:nth-child(2n + 2) {
    text-align: right;
  }

  & > *:nth-child(4n + 1),
  & > *:nth-child(4n + 2) {
    background-color: ${p => p.theme.tokens.background.primary};
  }
`;

const StyledVersion = styled(Version)`
  ${p => p.theme.overflowEllipsis}
  line-height: 1.6;
  font-variant-numeric: tabular-nums;
`;

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  height: ${PLACEHOLDER_AND_EMPTY_HEIGHT};
  justify-content: center;
`;

export default ProjectLatestReleases;
