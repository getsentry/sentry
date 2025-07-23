import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Breadcrumbs, type Crumb} from 'sentry/components/breadcrumbs';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import Placeholder from 'sentry/components/placeholder';
import {IconEllipsis, IconTelescope} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types';

type BuildDetailsHeaderError = {error: string; status: 'error'};
type BuildDetailsHeaderLoading = {status: 'loading'};
type BuildDetailsHeaderSuccess = {
  buildDetails: BuildDetailsApiResponse;
  status: 'success';
};

export type BuildDetailsHeaderContentProps =
  | BuildDetailsHeaderError
  | BuildDetailsHeaderLoading
  | BuildDetailsHeaderSuccess;

export function BuildDetailsHeaderContent(props: BuildDetailsHeaderContentProps) {
  const {status} = props;

  if (status === 'loading') {
    return (
      <HeaderContainer>
        <Placeholder height="20px" width="200px" style={{marginBottom: space(2)}} />
        <HeaderContent>
          <Title>
            <Placeholder height="32px" width="300px" />
          </Title>
          <Actions>
            <Placeholder height="32px" width="120px" style={{marginRight: space(1)}} />
            <Placeholder height="32px" width="40px" />
          </Actions>
        </HeaderContent>
      </HeaderContainer>
    );
  }

  if (status === 'error') {
    return (
      <HeaderContainer>
        <Alert type="error">{props.error}</Alert>
      </HeaderContainer>
    );
  }

  const {buildDetails} = props;

  // TODO: Implement proper breadcrumbs once release connection is implemented
  const breadcrumbs: Crumb[] = [
    {
      to: '#',
      label: 'Releases',
    },
    {
      to: '#',
      label: buildDetails.app_info.version,
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
        <Title>
          v{buildDetails.app_info.version} ({buildDetails.app_info.build_number})
        </Title>
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

const Title = styled('h1')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.textColor};
`;
