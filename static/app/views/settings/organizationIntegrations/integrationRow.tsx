import styled from '@emotion/styled';
import startCase from 'lodash/startCase';

import {Flex} from '@sentry/scraps/layout';

import {Alert} from 'sentry/components/core/alert';
import {Tag} from 'sentry/components/core/badge/tag';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import PanelItem from 'sentry/components/panels/panelItem';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';
import type {
  IntegrationInstallationStatus,
  PluginWithProjectList,
  SentryApp,
  SentryAppStatus,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {
  convertIntegrationTypeToSnakeCase,
  trackIntegrationAnalytics,
} from 'sentry/utils/integrationUtil';

import AlertContainer from './integrationAlertContainer';
import IntegrationStatus from './integrationStatus';
import PluginDeprecationAlert from './pluginDeprecationAlert';

type Props = {
  categories: string[];
  configurations: number;
  displayName: string;
  organization: Organization;
  publishStatus: SentryAppStatus;
  slug: string;
  type: 'plugin' | 'firstParty' | 'sentryApp' | 'docIntegration';
  /**
   * If provided, render an alert message with this text.
   */
  alertText?: string;
  customAlert?: React.ReactNode;
  customIcon?: React.ReactNode;
  plugin?: PluginWithProjectList;
  /**
   * If `alertText` was provided, this text overrides the "Resolve now" message
   * in the alert.
   */
  resolveText?: string;
  status?: IntegrationInstallationStatus;
};

const urlMap = {
  plugin: 'plugins',
  firstParty: 'integrations',
  sentryApp: 'sentry-apps',
  docIntegration: 'document-integrations',
};

function IntegrationRow(props: Props) {
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
      <Flex align="center" padding="xl">
        {customIcon ?? <PluginIcon size={36} pluginId={slug} />}
        <TitleContainer>
          <IntegrationName to={baseUrl}>{displayName}</IntegrationName>
          <IntegrationDetails>
            {renderStatus()}
            {renderDetails()}
          </IntegrationDetails>
        </TitleContainer>
        <Flex justify="end" wrap="wrap" flex="3" padding="0 xl" gap="md">
          {categories?.map(category => (
            <Tag key={category} variant={category === publishStatus ? 'info' : 'muted'}>
              {category === 'api' ? 'API' : startCase(category)}
            </Tag>
          ))}
        </Flex>
      </Flex>
      {alertText && (
        <AlertContainer>
          <Alert.Container>
            <Alert
              variant="warning"
              trailingItems={
                <ResolveNowButton
                  href={`${baseUrl}?tab=configurations&referrer=directory_resolve_now`}
                  size="xs"
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
              }
            >
              {alertText}
            </Alert>
          </Alert.Container>
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
}

const PluginDeprecationAlertWrapper = styled('div')`
  padding: 0px ${space(3)} 0px 68px;
`;

const PanelRow = styled(PanelItem)`
  flex-direction: column;
`;

const TitleContainer = styled('div')`
  flex: 1;
  padding: 0 16px;
  white-space: nowrap;
`;

const IntegrationName = styled(Link)`
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const IntegrationDetails = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSize.sm};
`;

const StyledLink = styled(Link)`
  color: ${p => p.theme.tokens.content.secondary};
  &:before {
    content: '|';
    color: ${p => p.theme.tokens.content.secondary};
    margin-right: ${space(0.75)};
  }
`;

const LearnMore = styled(Link)`
  color: ${p => p.theme.tokens.content.secondary};
`;

type PublishStatusProps = {status: SentryApp['status']};

const PublishStatus = styled(({status, ...props}: PublishStatusProps) => (
  <div {...props}>{status}</div>
))`
  color: ${p =>
    p.status === 'published'
      ? p.theme.tokens.content.success
      : p.theme.tokens.content.secondary};
  font-weight: light;
  margin-right: ${space(0.75)};
  text-transform: capitalize;
  &:before {
    content: '|';
    color: ${p => p.theme.tokens.content.secondary};
    margin-right: ${space(0.75)};
    font-weight: ${p => p.theme.fontWeight.normal};
  }
`;

const ResolveNowButton = styled(LinkButton)`
  color: ${p => p.theme.tokens.content.secondary};
  float: right;
`;

export default IntegrationRow;
