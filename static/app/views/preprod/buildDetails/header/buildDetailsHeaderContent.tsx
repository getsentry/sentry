import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Breadcrumbs, type Crumb} from 'sentry/components/breadcrumbs';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text';
import Placeholder from 'sentry/components/placeholder';
import {IconEllipsis, IconTelescope} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

interface BuildDetailsHeaderContentProps {
  buildDetailsQuery: UseApiQueryResult<BuildDetailsApiResponse, RequestError>;
}

export function BuildDetailsHeaderContent(props: BuildDetailsHeaderContentProps) {
  const {buildDetailsQuery} = props;

  const {
    data: buildDetailsData,
    isPending: isBuildDetailsPending,
    isError: isBuildDetailsError,
    error: buildDetailsError,
  } = buildDetailsQuery;

  if (isBuildDetailsPending) {
    return (
      <Flex direction="column" style={{padding: `0 0 ${space(2)} 0`}}>
        <Placeholder height="20px" width="200px" style={{marginBottom: space(2)}} />
        <Flex align="center" justify="between" gap="md">
          <Heading as="h1">
            <Placeholder height="32px" width="300px" />
          </Heading>
          <Flex align="center" gap="sm" style={{flexShrink: 0}}>
            <Placeholder height="32px" width="120px" style={{marginRight: space(1)}} />
            <Placeholder height="32px" width="40px" />
          </Flex>
        </Flex>
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

  const handleCompareBuild = () => {
    // TODO: Implement compare build functionality
    addErrorMessage('Not implemented (coming soon)');
  };

  const handleMoreActions = () => {
    // TODO: Implement more actions menu
    addErrorMessage('Not implemented (coming soon)');
  };

  return (
    <Flex direction="column" style={{padding: `0 0 ${space(2)} 0`}}>
      <Breadcrumbs crumbs={breadcrumbs} />
      <Flex align="center" justify="between" gap="md">
        <Heading as="h1">
          v{buildDetailsData.app_info.version} ({buildDetailsData.app_info.build_number})
        </Heading>
        <Flex align="center" gap="sm" style={{flexShrink: 0}}>
          <Button
            size="sm"
            priority="default"
            icon={<IconTelescope />}
            onClick={handleCompareBuild}
          >
            {'Compare Build'}
          </Button>
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
