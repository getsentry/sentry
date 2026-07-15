import styled from '@emotion/styled';
import startCase from 'lodash/startCase';

import {Tag} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {PanelItem} from 'sentry/components/panels/panelItem';
import {IconWarning} from 'sentry/icons';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import {t, tct, tn} from 'sentry/locale';
import type {
  IntegrationInstallationStatus,
  SentryApp,
  SentryAppStatus,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  canManageIntegrations,
  convertIntegrationTypeToSnakeCase,
  getIntegrationNoun,
} from 'sentry/utils/integrationUtil';

import {IntegrationStatus} from './integrationStatus';

type Props = {
  categories: string[];
  configurations: number;
  displayName: string;
  organization: Organization;
  publishStatus: SentryAppStatus;
  slug: string;
  type: 'firstParty' | 'sentryApp' | 'docIntegration';
  customAlert?: React.ReactNode;
  customIcon?: React.ReactNode;
  disabledConfigurations?: number;
  outdatedConfigurations?: number;
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
    outdatedConfigurations = 0,
    customAlert,
    customIcon,
    disabledConfigurations,
  } = props;

  const baseUrl =
    publishStatus === 'internal'
      ? `/settings/${organization.slug}/developer-settings/${slug}/`
      : `/settings/${organization.slug}/${urlMap[type]}/${slug}/`;

  const hasIntegrationAccess = canManageIntegrations(organization);

  // When exactly one workspace is outdated there's nothing to disambiguate, so
  // auto-open the relevant modal instead of making the user pick on the config
  // page. With multiple outdated workspaces we send them to the config tab to
  // choose which one to update. Members who can't manage integrations never get
  // the auto-open param, since they can't act on the reinstall flow.
  //
  // GitHub's outdated state means missing app permissions, not a reinstall, so
  // it opens the update-permissions modal (showPermsModal) rather than the
  // install modal (showInstallModal).
  const getAutoOpenParam = () => {
    if (!hasIntegrationAccess || outdatedConfigurations !== 1) {
      return '';
    }

    switch (slug) {
      case 'github':
        return '&showPermsModal=1';
      default:
        return '&showInstallModal=1';
    }
  };
  const resolveNowHref = `${baseUrl}?tab=configurations&referrer=directory_resolve_now${getAutoOpenParam()}`;

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

  const getUpgradeTooltipTitle = () => {
    if (!hasIntegrationAccess) {
      return tct(
        "There's a new update for your [displayName] integration, please update your [noun]",
        {displayName, noun: getIntegrationNoun(slug)}
      );
    }
    return tct(
      "There's a new update for your [displayName] integration, please [link:click here] to update your [noun]",
      {
        displayName,
        noun: getIntegrationNoun(slug),
        link: (
          <Link
            to={resolveNowHref}
            onClick={() =>
              trackAnalytics('integrations.resolve_now_clicked', {
                integration_type: convertIntegrationTypeToSnakeCase(type),
                integration: slug,
                organization,
              })
            }
          />
        ),
      }
    );
  };

  return (
    <PanelRow noPadding data-test-id={slug}>
      <Flex align="center" padding="xl">
        {customIcon ?? <PluginIcon size={36} pluginId={slug} />}
        <TitleContainer>
          <Flex gap="xs" align="center">
            <IntegrationName to={baseUrl}>{displayName}</IntegrationName>
            {outdatedConfigurations > 0 && (
              <Tooltip
                isHoverable
                containerDisplayMode="flex"
                title={getUpgradeTooltipTitle()}
              >
                <IconWarning variant="warning" aria-label={t('Integration alert')} />
              </Tooltip>
            )}
          </Flex>
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
