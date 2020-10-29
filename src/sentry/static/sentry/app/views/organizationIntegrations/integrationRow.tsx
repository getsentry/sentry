import React from 'react';
import styled from '@emotion/styled';
import startCase from 'lodash/startCase';

import {IconWarning} from 'app/icons';
import Button from 'app/components/button';
import Alert from 'app/components/alert';
import Link from 'app/components/links/link';
import {PanelItem} from 'app/components/panels';
import PluginIcon from 'app/plugins/components/pluginIcon';
import space from 'app/styles/space';
import {Organization, SentryApp, IntegrationInstallationStatus} from 'app/types';
import {t} from 'app/locale';
import {
  trackIntegrationEvent,
  convertIntegrationTypeToSnakeCase,
} from 'app/utils/integrationUtil';

import IntegrationStatus from './integrationStatus';

type Props = {
  organization: Organization;
  type: 'plugin' | 'firstParty' | 'sentryApp' | 'documentIntegration';
  slug: string;
  displayName: string;
  status?: IntegrationInstallationStatus;
  publishStatus: 'unpublished' | 'published' | 'internal';
  configurations: number;
  categories: string[];
  alertText?: string;
};

const urlMap = {
  plugin: 'plugins',
  firstParty: 'integrations',
  sentryApp: 'sentry-apps',
  documentIntegration: 'document-integrations',
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
    alertText,
  } = props;

  const baseUrl =
    publishStatus === 'internal'
      ? `/settings/${organization.slug}/developer-settings/${slug}/`
      : `/settings/${organization.slug}/${urlMap[type]}/${slug}/`;

  const renderDetails = () => {
    if (type === 'sentryApp') {
      return publishStatus !== 'published' && <PublishStatus status={publishStatus} />;
    }
    //TODO: Use proper translations
    return configurations > 0 ? (
      <StyledLink to={`${baseUrl}?tab=configurations`}>{`${configurations} Configuration${
        configurations > 1 ? 's' : ''
      }`}</StyledLink>
    ) : null;
  };

  const renderStatus = () => {
    //status should be undefined for document integrations
    if (status) {
      return <IntegrationStatus status={status} />;
    }
    return <LearnMore to={baseUrl}>{t('Learn More')}</LearnMore>;
  };

  return (
    <PanelItem p={0} flexDirection="column" data-test-id={slug}>
      <FlexContainer>
        <PluginIcon size={36} pluginId={slug} />
        <Container>
          <IntegrationName to={baseUrl}>{displayName}</IntegrationName>
          <IntegrationDetails>
            {renderStatus()}
            {renderDetails()}
          </IntegrationDetails>
        </Container>
        <InternalContainer>
          {categories?.map(category => (
            <CategoryTag
              key={category}
              category={startCase(category)}
              priority={category === publishStatus}
            />
          ))}
        </InternalContainer>
      </FlexContainer>
      {alertText && (
        <AlertContainer>
          <Alert type="warning" icon={<IconWarning size="sm" />}>
            <span>{alertText}</span>
            <ResolveNowButton
              href={`${baseUrl}?tab=configurations&referrer=directory_resolve_now`}
              size="xsmall"
              onClick={() =>
                trackIntegrationEvent(
                  {
                    eventKey: 'integrations.resolve_now_clicked',
                    eventName: 'Integrations: Resolve Now Clicked',
                    integration_type: convertIntegrationTypeToSnakeCase(type),
                    integration: slug,
                  },
                  organization
                )
              }
            >
              {t('Resolve Now')}
            </ResolveNowButton>
          </Alert>
        </AlertContainer>
      )}
    </PanelItem>
  );
};

const FlexContainer = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(2)};
`;

const InternalContainer = styled(FlexContainer)`
  padding: 0 ${space(2)};
`;

const Container = styled('div')`
  flex: 1;
  padding: 0 16px;
`;

const IntegrationName = styled(Link)`
  font-weight: bold;
  color: ${p => p.theme.blue400};
`;

const IntegrationDetails = styled('div')`
  display: flex;
  align-items: center;
  margin-top: 6px;
  font-size: 0.8em;
`;

const StyledLink = styled(Link)`
  color: ${p => p.theme.gray500};
  &:before {
    content: '|';
    color: ${p => p.theme.gray400};
    margin-right: ${space(0.75)};
    font-weight: normal;
  }
`;

const LearnMore = styled(Link)`
  color: ${p => p.theme.gray500};
`;

type PublishStatusProps = {status: SentryApp['status']; theme?: any};

const PublishStatus = styled(({status, ...props}: PublishStatusProps) => (
  <div {...props}>{t(`${status}`)}</div>
))`
  color: ${(props: PublishStatusProps) =>
    props.status === 'published' ? props.theme.success : props.theme.gray500};
  font-weight: light;
  margin-right: ${space(0.75)};
  text-transform: capitalize;
  &:before {
    content: '|';
    color: ${p => p.theme.gray400};
    margin-right: ${space(0.75)};
    font-weight: normal;
  }
`;

const CategoryTag = styled(
  ({
    priority: _priority,
    category,
    ...p
  }: {
    category: string;
    priority: boolean;
    theme?: any;
  }) => <div {...p}>{category}</div>
)`
  display: flex;
  flex-direction: row;
  padding: 1px 10px;
  background: ${p => (p.priority ? p.theme.purple300 : p.theme.gray300)};
  border-radius: 20px;
  font-size: ${space(1.5)};
  margin-right: ${space(1)};
  line-height: ${space(3)};
  text-align: center;
  color: ${p => (p.priority ? p.theme.white : p.theme.gray700)};
`;

const ResolveNowButton = styled(Button)`
  color: ${p => p.theme.gray500};
  background: #ffffff;
  float: right;
`;

const AlertContainer = styled('div')`
  padding: 0px ${space(3)} 0px 68px;
`;

export default IntegrationRow;
