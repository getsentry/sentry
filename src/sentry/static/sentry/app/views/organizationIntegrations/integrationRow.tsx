import React from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import Link from 'app/components/links/link';
import {PanelItem} from 'app/components/panels';
import PluginIcon from 'app/plugins/components/pluginIcon';
import space from 'app/styles/space';
import {
  IntegrationProvider,
  Integration,
  PluginWithProjectList,
  Organization,
  PluginProjectItem,
  SentryApp,
  SentryAppInstallation,
} from 'app/types';
import {t} from 'app/locale';

import IntegrationStatus from './integrationStatus';
import {mapped} from './integrationUtil';

type AppOrProviderOrPlugin = SentryApp | IntegrationProvider | PluginWithProjectList;

type InstalledList = Integration[] | PluginProjectItem[] | SentryAppInstallation[];

type Props = {
  integration: AppOrProviderOrPlugin;
  installed: InstalledList;
  isLegacy?: boolean;
  organization: Organization;
  type: 'plugin' | 'provider' | 'sentry-app';
};

const urltypes = {
  plugin: 'plugins',
  provider: 'integrations',
  'sentry-app': 'sentry-apps',
};

const IntegrationRow = (props: Props) => {
  const {
    integration,
    installed,
    organization: {slug},
    type,
    isLegacy,
  } = props;

  const map = mapped(integration, type);
  const baseUrl = `/settings/${slug}/${urltypes[type]}/${map['id']}/`;

  const getStatus = () => {
    if (installed.length > 0) {
      if (type === 'sentry-app') {
        return capitalize((installed[0] as SentryAppInstallation).status) as
          | 'Installed'
          | 'Pending';
      }
      return 'Installed';
    }
    return 'Not Installed';
  };

  const isPublished = () => {
    return (integration as SentryApp).status === 'published';
  };

  const renderDetails = () => {
    if (type === 'sentry-app') {
      return (
        !isPublished() && <PublishStatus status={(integration as SentryApp).status} />
      );
    }
    return installed.length > 0 ? (
      <StyledLink to={`${baseUrl}?tab=configurations`}>{`${
        installed.length
      } Configuration${installed.length > 1 ? 's' : ''}`}</StyledLink>
    ) : null;
  };

  return (
    <PanelItem p={0} flexDirection="column" data-test-id={map['id']}>
      <Flex style={{alignItems: 'center', padding: '16px'}}>
        <PluginIcon size={36} pluginId={map['id']} />
        <div style={{flex: '1', padding: '0 16px'}}>
          <ProviderName to={baseUrl}>
            {`${map['name']} ${!!isLegacy ? '(Legacy)' : ''}`}
          </ProviderName>
          <ProviderDetails>
            <IntegrationStatus status={getStatus()} />
            {renderDetails()}
          </ProviderDetails>
        </div>
      </Flex>
    </PanelItem>
  );
};

const Flex = styled('div')`
  display: flex;
`;

const ProviderName = styled(Link)`
  font-weight: bold;
  color: ${props => props.theme.textColor};
`;

const ProviderDetails = styled(Flex)`
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

const FlexContainer = styled(Flex)`
  align-items: center;
`;

type PublishStatusProps = {status: SentryApp['status']; theme?: any};

const PublishStatus = styled(({status, ...props}: PublishStatusProps) => {
  return (
    <FlexContainer>
      <div {...props}>{t(`${status}`)}</div>
    </FlexContainer>
  );
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
