import styled from '@emotion/styled';
import startCase from 'lodash/startCase';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {PanelItem} from 'sentry/components/panels/panelItem';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t, tn} from 'sentry/locale';
import type {
  IntegrationInstallationStatus,
  SentryApp,
  SentryAppStatus,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {
  convertIntegrationTypeToSnakeCase,
  trackIntegrationAnalytics,
} from 'sentry/utils/integrationUtil';

import {AlertContainer} from './integrationAlertContainer';
import {IntegrationStatus} from './integrationStatus';

type Props = {
  categories: string[];
  configurations: number;
  displayName: string;
  organization: Organization;
  publishStatus: SentryAppStatus;
  slug: string;
  type: 'firstParty' | 'sentryApp' | 'docIntegration';
  /**
   * If provided, render an alert message with this text.
   */
  alertText?: string;
  customAlert?: React.ReactNode;
  customIcon?: React.ReactNode;
  disabledConfigurations?: number;
  /**
   * If `alertText` was provided, this text overrides the "Resolve now" message
   * in the alert.
   */
  resolveText?: string;
  status?: IntegrationInstallationStatus;
};

const urlMap = {
  firstParty: 'integrations',
  sentryApp: 'sentry-apps',
  docIntegration: 'document-integrations',
};

export function IntegrationRow(props: Props) {
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
    customAlert,
    customIcon,
    disabledConfigurations,
  } = props;

  const baseUrl =
    publishStatus === 'internal'
      ? `/settings/${organization.slug}/developer-settings/${slug}/`
      : `/settings/${organization.slug}/${urlMap[type]}/${slug}/`;

  // When there's exactly one installed workspace there's nothing to
  // disambiguate, so auto-open the install/upgrade modal (via
  // `useAutoOpenInstallModal`) instead of making the user pick on the config
  // page. With multiple workspaces we still send them to the config tab to
  // choose which one to update.
  const resolveNowHref =
    `${baseUrl}?tab=configurations&referrer=directory_resolve_now` +
    (configurations === 1 ? '&showInstallModal=1' : '');

  const renderDetails = () => {
    if (type === 'sentryApp') {
      return publishStatus !== 'published' && <PublishStatus status={publishStatus} />;
    }
    if (configurations <= 0) {
      return null;
    }
    return (
      <Flex align="center" gap="xs">
        <StyledLink to={`${baseUrl}?tab=configurations`}>
          {tn('%s Configuration', '%s Configurations', configurations)}
        </StyledLink>
        {disabledConfigurations ? (
          <Tag variant="warning">
            {tn('%s disabled', '%s disabled', disabledConfigurations)}
          </Tag>
        ) : null}
      </Flex>
    );
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
        <Flex justify="end" wrap="wrap" flex={3} padding="0 xl" gap="md">
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
                <LinkButton
                  href={resolveNowHref}
                  variant="primary"
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
                </LinkButton>
              }
            >
              {alertText}
            </Alert>
          </Alert.Container>
        </AlertContainer>
      )}
      {customAlert}
    </PanelRow>
  );
}

const PanelRow = styled(PanelItem)`
  flex-direction: column;
`;

const TitleContainer = styled('div')`
  flex: 1;
  padding: 0 16px;
  white-space: nowrap;
`;

const IntegrationName = styled(Link)`
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;

const IntegrationDetails = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.font.size.sm};
`;

const StyledLink = styled(Link)`
  color: ${p => p.theme.tokens.content.secondary};
  &:before {
    content: '|';
    color: ${p => p.theme.tokens.content.secondary};
    margin-right: ${p => p.theme.space.sm};
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
  margin-right: ${p => p.theme.space.sm};
  text-transform: capitalize;
  &:before {
    content: '|';
    color: ${p => p.theme.tokens.content.secondary};
    margin-right: ${p => p.theme.space.sm};
    font-weight: ${p => p.theme.font.weight.sans.regular};
  }
`;
