import {Link} from 'react-router-dom';

import {Breadcrumbs, type Crumb} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis, IconTelescope} from 'sentry/icons';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import useOrganization from 'sentry/utils/useOrganization';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

import {createActionMenuItems} from './buildDetailsActionItems';
import {useBuildDetailsActions} from './useBuildDetailsActions';

function makeReleasesUrl(
  projectSlug: string | undefined,
  query: {appId?: string; version?: string}
): string {
  const {appId, version} = query;

  // Not knowing the projectSlug should be transient.
  if (projectSlug === undefined) {
    return '#';
  }

  const params = new URLSearchParams();
  params.set('project', projectSlug);
  const parts = [];
  if (appId) {
    parts.push(`release.package:${appId}`);
  }
  if (version) {
    parts.push(`release.version:${version}`);
  }
  if (parts.length) {
    params.set('query', parts.join(' '));
  }
  return `/explore/releases/?${params}`;
}

interface BuildDetailsHeaderContentProps {
  artifactId: string;
  buildDetailsQuery: UseApiQueryResult<BuildDetailsApiResponse, RequestError>;
  projectSlug: string;
}

export function BuildDetailsHeaderContent(props: BuildDetailsHeaderContentProps) {
  const organization = useOrganization();
  const isSentryEmployee = useIsSentryEmployee();
  const {buildDetailsQuery, projectSlug, artifactId} = props;
  const {isDeletingArtifact, handleDeleteAction, handleDownloadAction} =
    useBuildDetailsActions({
      projectSlug,
      artifactId,
    });

  const {
    data: buildDetailsData,
    isPending: isBuildDetailsPending,
    isError: isBuildDetailsError,
  } = buildDetailsQuery;

  // TODO(preprod): for now show nothing for loading/error states, but in the future we
  // might be able to show the release breadcrumb
  if (isBuildDetailsPending) {
    return (
      <Flex direction="column" padding="0 0 xl 0">
        {/* Empty header space - no skeleton content */}
      </Flex>
    );
  }

  if (isBuildDetailsError || !buildDetailsData) {
    return (
      <Flex direction="column" padding="0 0 xl 0">
        {/* Empty header space during error */}
      </Flex>
    );
  }

  const project = ProjectsStore.getBySlug(projectSlug);

  const breadcrumbs: Crumb[] = [
    {
      to: makeReleasesUrl(project?.id, {
        version: buildDetailsData.app_info.version ?? undefined,
      }),
      label: 'Releases',
    },
  ];

  if (buildDetailsData.app_info.version) {
    breadcrumbs.push({
      to: makeReleasesUrl(project?.id, {
        version: buildDetailsData.app_info.version ?? undefined,
        appId: buildDetailsData.app_info.app_id ?? undefined,
      }),
      label: buildDetailsData.app_info.version,
    });
  }

  breadcrumbs.push({
    label: 'Build Details',
  });

  const actionMenuItems = createActionMenuItems({
    handleDeleteAction,
    handleDownloadAction,
    isSentryEmployee,
  });

  return (
    <Flex direction="column" padding="0 0 xl 0">
      <Breadcrumbs crumbs={breadcrumbs} />
      <Flex align="center" justify="between" gap="md">
        <Heading as="h1">
          v{buildDetailsData.app_info.version} ({buildDetailsData.app_info.build_number})
        </Heading>
        <Flex align="center" gap="sm" flexShrink={0}>
          <Link
            to={`/organizations/${organization.slug}/preprod/${projectSlug}/compare/${buildDetailsData.id}/`}
          >
            <Button size="sm" priority="default" icon={<IconTelescope />}>
              {t('Compare Build')}
            </Button>
          </Link>
          <DropdownMenu
            items={actionMenuItems}
            trigger={(triggerProps, _isOpen) => (
              <DropdownButton
                {...triggerProps}
                size="sm"
                aria-label="More actions"
                showChevron={false}
                disabled={isDeletingArtifact || !artifactId}
              >
                <IconEllipsis />
              </DropdownButton>
            )}
          />
        </Flex>
      </Flex>
    </Flex>
  );
}
