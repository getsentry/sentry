import React from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import Link from 'app/components/links/link';
import {PanelItem} from 'app/components/panels';
import PluginIcon from 'app/plugins/components/pluginIcon';
import space from 'app/styles/space';
import {Organization, SentryApp} from 'app/types';
import {t} from 'app/locale';

import IntegrationStatus from './integrationStatus';

type Props = {
  organization: Organization;
  type: 'plugin' | 'provider' | 'sentry-app';
  slug: string;
  displayName: string;
  status: 'Installed' | 'Not Installed' | 'Pending';
  publishStatus: 'unpublished' | 'published' | 'internal';
  installations: number;
};

const urlMap = {
  plugin: 'plugins',
  provider: 'integrations',
  'sentry-app': 'sentry-apps',
};

const IntegrationRow = (props: Props) => {
  const {
    organization,
    type,
    slug,
    displayName,
    status,
    publishStatus,
    installations,
  } = props;

  const baseUrl = `/settings/${organization.slug}/${urlMap[type]}/${slug}/`;

  const renderDetails = () => {
    if (type === 'sentry-app') {
      return publishStatus !== 'published' && <PublishStatus status={publishStatus} />;
    }
    return installations > 0 ? (
      <StyledLink to={`${baseUrl}?tab=configurations`}>{`${installations} Configuration${
        installations > 1 ? 's' : ''
      }`}</StyledLink>
    ) : null;
  };

  return (
    <PanelItem p={0} flexDirection="column" data-test-id={slug}>
      <FlexContainer>
        <PluginIcon size={36} pluginId={slug} />
        <Container>
          <IntegrationName to={baseUrl}>{displayName}</IntegrationName>
          <IntegrationDetails>
            <IntegrationStatus status={status} />
            {renderDetails()}
          </IntegrationDetails>
        </Container>
      </FlexContainer>
    </PanelItem>
  );
};

const FlexContainer = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(2)};
`;

const Container = styled('div')`
  flex: 1;
  padding: 0 16px;
`;

const IntegrationName = styled(Link)`
  font-weight: bold;
  color: ${props => props.theme.textColor};
`;

const IntegrationDetails = styled('div')`
  display: flex;
  align-items: center;
  margin-top: 6px;
  font-size: 0.8em;
`;

const StyledLink = styled(Link)`
  color: ${p => p.theme.gray2};
  &:before {
    content: '|';
    color: ${p => p.theme.gray1};
    margin-right: ${space(0.75)};
    font-weight: normal;
  }
`;

type PublishStatusProps = {status: SentryApp['status']; theme?: any};

const PublishStatus = styled(({status, ...props}: PublishStatusProps) => {
  return <div {...props}>{t(`${status}`)}</div>;
})`
  color: ${(props: PublishStatusProps) =>
    props.status === 'published' ? props.theme.success : props.theme.gray2};
  font-weight: light;
  margin-right: ${space(0.75)};
  text-transform: capitalize;
  &:before {
    content: '|';
    color: ${p => p.theme.gray1};
    margin-right: ${space(0.75)};
    font-weight: normal;
  }
`;

export default IntegrationRow;
