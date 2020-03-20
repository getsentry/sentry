import React from 'react';
import styled from '@emotion/styled';

import Link from 'app/components/links/link';
import {PanelItem} from 'app/components/panels';
import PluginIcon from 'app/plugins/components/pluginIcon';
import space from 'app/styles/space';
import {Organization, SentryApp, IntegrationInstallationStatus} from 'app/types';
import {t} from 'app/locale';

import IntegrationStatus from './integrationStatus';

type Props = {
  organization: Organization;
  type: 'plugin' | 'firstParty' | 'sentryApp';
  slug: string;
  displayName: string;
  status: IntegrationInstallationStatus;
  publishStatus: 'unpublished' | 'published' | 'internal';
  configurations: number;
  categories?: string[];
};

const urlMap = {
  plugin: 'plugins',
  firstParty: 'integrations',
  sentryApp: 'sentry-apps',
};

const IntegrationRow = (props: Props) => {
  const {
    organization,
    type,
    slug,
    displayName,
    status,
    publishStatus,
    configurations,
    categories,
  } = props;

  const baseUrl =
    publishStatus === 'internal'
      ? `/settings/${organization.slug}/developer-settings/${slug}/`
      : `/settings/${organization.slug}/${urlMap[type]}/${slug}/`;

  const renderDetails = () => {
    if (type === 'sentryApp') {
      return publishStatus !== 'published' && <PublishStatus status={publishStatus} />;
    }
    return configurations > 0 ? (
      <StyledLink to={`${baseUrl}?tab=configurations`}>{`${configurations} Configuration${
        configurations > 1 ? 's' : ''
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
        <FlexContainer>
          {categories?.map(category => (
            <CategoryTag
              key={category}
              category={category}
              publishStatus={publishStatus}
            />
          ))}
        </FlexContainer>
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
  color: ${p => p.theme.blue};
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

const PublishStatus = styled(({status, ...props}: PublishStatusProps) => (
  <div {...props}>{t(`${status}`)}</div>
))`
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

const CategoryTag = styled(({category, ...p}) => <div {...p}>{category}</div>)`
  display: flex;
  flex-direction: row;
  padding: 1px 10px;
  background: ${p =>
    p.category === p.publishStatus ? p.theme.purpleLightest : p.theme.offWhite2};
  border-radius: 20px;
  font-size: ${space(1.5)};
  margin-right: ${space(1)};
  line-height: ${space(3)};
  text-align: center;
  color: ${p => (p.category === p.publishStatus ? p.theme.white : p.theme.gray4)};
`;

export default IntegrationRow;
