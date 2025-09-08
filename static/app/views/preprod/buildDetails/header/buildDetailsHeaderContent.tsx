import {Link} from 'react-router-dom';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Breadcrumbs, type Crumb} from 'sentry/components/breadcrumbs';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text';
import {IconEllipsis, IconTelescope} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

interface BuildDetailsHeaderContentProps {
  buildDetailsQuery: UseApiQueryResult<BuildDetailsApiResponse, RequestError>;
  projectId: string;
}

export function BuildDetailsHeaderContent(props: BuildDetailsHeaderContentProps) {
  const organization = useOrganization();
  const {buildDetailsQuery, projectId} = props;

  const {
    data: buildDetailsData,
    isPending: isBuildDetailsPending,
    isError: isBuildDetailsError,
    error: buildDetailsError,
  } = buildDetailsQuery;

  if (isBuildDetailsPending) {
    return (
      <Flex direction="column" padding="0 0 xl 0">
        {/* Empty header space - no skeleton content */}
      </Flex>
    );
  }

  if (isBuildDetailsError) {
    return <Alert type="error">{buildDetailsError?.message}</Alert>;
  }

  if (!buildDetailsData) {
    return <Alert type="error">No build details found</Alert>;
  }

  // TODO: Implement proper breadcrumbs once release connection is implemented
  const breadcrumbs: Crumb[] = [
    {
      to: '#',
      label: 'Releases',
    },
    {
      to: '#',
      label: buildDetailsData.app_info.version,
    },
    {
      label: 'Build Details',
    },
  ];

  const handleMoreActions = () => {
    // TODO: Implement more actions menu
    addErrorMessage('Not implemented (coming soon)');
  };

  return (
    <Flex direction="column" padding="0 0 xl 0">
      <Breadcrumbs crumbs={breadcrumbs} />
      <Flex align="center" justify="between" gap="md">
        <Heading as="h1">
          v{buildDetailsData.app_info.version} ({buildDetailsData.app_info.build_number})
        </Heading>
        <Flex align="center" gap="sm" flexShrink={0}>
          <Link
            to={`/organizations/${organization.slug}/preprod/${projectId}/compare/${buildDetailsData.id}/`}
          >
            <Button size="sm" priority="default" icon={<IconTelescope />}>
              {t('Compare Build')}
            </Button>
          </Link>
          {/* TODO: Actions dropdown */}
          <Button
            size="sm"
            priority="default"
            icon={<IconEllipsis />}
            onClick={handleMoreActions}
            aria-label={'More actions'}
          />
        </Flex>
      </Flex>
    </Flex>
  );
}
