import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Breadcrumbs, type Crumb} from 'sentry/components/breadcrumbs';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
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
      <HeaderContainer>
        <Placeholder height="20px" width="200px" style={{marginBottom: space(2)}} />
        <HeaderContent>
          <Heading as="h1">
            <Placeholder height="32px" width="300px" />
          </Heading>
          <Actions>
            <Placeholder height="32px" width="120px" style={{marginRight: space(1)}} />
            <Placeholder height="32px" width="40px" />
          </Actions>
        </HeaderContent>
      </HeaderContainer>
    );
  }

  if (isBuildDetailsError) {
    return (
      <HeaderContainer>
        <Alert type="error">{buildDetailsError?.message}</Alert>
      </HeaderContainer>
    );
  }

  if (!buildDetailsData) {
    return (
      <HeaderContainer>
        <Alert type="error">No build details found</Alert>
      </HeaderContainer>
    );
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
    <HeaderContainer>
      <Breadcrumbs crumbs={breadcrumbs} />
      <HeaderContent>
        <Heading as="h1">
          v{buildDetailsData.app_info.version} ({buildDetailsData.app_info.build_number})
        </Heading>
        <Actions>
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
        </Actions>
      </HeaderContent>
    </HeaderContainer>
  );
}

const HeaderContainer = styled('div')`
  padding: 0 0 ${space(2)} 0;
`;

const HeaderContent = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space(2)};
`;

const Actions = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  flex-shrink: 0;
`;
