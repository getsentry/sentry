import React from 'react';
import styled from '@emotion/styled';
import startCase from 'lodash/startCase';

import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import {PanelItem} from 'sentry/components/panels';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import space from 'sentry/styles/space';
import {
  IntegrationInstallationStatus,
  Organization,
  PluginWithProjectList,
  SentryApp,
} from 'sentry/types';
import {
  convertIntegrationTypeToSnakeCase,
  trackIntegrationAnalytics,
} from 'sentry/utils/integrationUtil';

import AlertContainer from './integrationAlertContainer';
import IntegrationStatus from './integrationStatus';
import PluginDeprecationAlert from './pluginDeprecationAlert';

type Props = {
  organization: Organization;
  type: 'plugin' | 'firstParty' | 'sentryApp' | 'docIntegration';
  slug: string;
  displayName: string;
  publishStatus: 'unpublished' | 'published' | 'internal';
  configurations: number;
  categories: string[];
  status?: IntegrationInstallationStatus;
  /**
   * If provided, render an alert message with this text.
   */
  alertText?: string;
  /**
   * If `alertText` was provided, this text overrides the "Resolve now" message
   * in the alert.
   */
  resolveText?: string;
  customAlert?: React.ReactNode;
  plugin?: PluginWithProjectList;
  customIcon?: React.ReactNode;
};

const urlMap = {
  plugin: 'plugins',
  firstParty: 'integrations',
  sentryApp: 'sentry-apps',
  docIntegration: 'document-integrations',
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
    resolveText,
    plugin,
    customAlert,
    customIcon,
  } = props;

  const baseUrl =
    publishStatus === 'internal'
      ? `/settings/${organization.slug}/developer-settings/${slug}/`
      : `/settings/${organization.slug}/${urlMap[type]}/${slug}/`;

  const renderDetails = () => {
    if (type === 'sentryApp') {
      return publishStatus !== 'published' && <PublishStatus status={publishStatus} />;
    }
    // TODO: Use proper translations
    return configurations > 0 ? (
      <StyledLink to={`${baseUrl}?tab=configurations`}>{`${configurations} Configuration${
        configurations > 1 ? 's' : ''
      }`}</StyledLink>
    ) : null;
  };

  const renderStatus = () => {
    // status should be undefined for document integrations
    if (status) {
      return <IntegrationStatus status={status} />;
    }
    return <LearnMore to={baseUrl}>{t('Learn More')}</LearnMore>;
  };

  return (
    <PanelRow noPadding data-test-id={slug}>
      <FlexContainer>
        {customIcon ?? <PluginIcon size={36} pluginId={slug} />}
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
                trackIntegrationAnalytics('integrations.resolve_now_clicked', {
                  integration_type: convertIntegrationTypeToSnakeCase(type),
                  integration: slug,
                  organization,
                })
              }
            >
              {resolveText || t('Resolve Now')}
            </ResolveNowButton>
          </Alert>
        </AlertContainer>
      )}
      {customAlert}
      {plugin?.deprecationDate && (
        <PluginDeprecationAlertWrapper>
          <PluginDeprecationAlert organization={organization} plugin={plugin} />
        </PluginDeprecationAlertWrapper>
      )}
    </PanelRow>
  );
};

const PluginDeprecationAlertWrapper = styled('div')`
  padding: 0px ${space(3)} 0px 68px;
`;

const PanelRow = styled(PanelItem)`
  flex-direction: column;
`;

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
`;

const IntegrationDetails = styled('div')`
  display: flex;
  align-items: center;
  margin-top: 6px;
  font-size: 0.8em;
`;

const StyledLink = styled(Link)`
  color: ${p => p.theme.gray300};
  &:before {
    content: '|';
    color: ${p => p.theme.gray200};
    margin-right: ${space(0.75)};
    font-weight: normal;
  }
`;

const LearnMore = styled(Link)`
  color: ${p => p.theme.gray300};
`;

type PublishStatusProps = {status: SentryApp['status']; theme?: any};

const PublishStatus = styled(({status, ...props}: PublishStatusProps) => (
  <div {...props}>{t(`${status}`)}</div>
))`
  color: ${(props: PublishStatusProps) =>
    props.status === 'published' ? props.theme.success : props.theme.gray300};
  font-weight: light;
  margin-right: ${space(0.75)};
  text-transform: capitalize;
  &:before {
    content: '|';
    color: ${p => p.theme.gray200};
    margin-right: ${space(0.75)};
    font-weight: normal;
  }
`;

// TODO(Priscila): Replace this component with the Tag component
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
  background: ${p => (p.priority ? p.theme.purple200 : p.theme.gray100)};
  border-radius: 20px;
  font-size: ${space(1.5)};
  margin-right: ${space(1)};
  line-height: ${space(3)};
  text-align: center;
  color: ${p => (p.priority ? p.theme.white : p.theme.gray500)};
`;

const ResolveNowButton = styled(Button)`
  color: ${p => p.theme.subText};
  float: right;
`;

export default IntegrationRow;
