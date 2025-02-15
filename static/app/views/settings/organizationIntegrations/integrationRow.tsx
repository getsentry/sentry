import styled from '@emotion/styled';
import startCase from 'lodash/startCase';

import {Alert} from 'sentry/components/alert';
import {LinkButton} from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import PanelItem from 'sentry/components/panels/panelItem';
import {t} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
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
      <FlexContainer>
        {customIcon ?? <PluginIcon size={36} pluginId={slug} />}
        <TitleContainer>
          <IntegrationName to={baseUrl}>{displayName}</IntegrationName>
          <IntegrationDetails>
            {renderStatus()}
            {renderDetails()}
          </IntegrationDetails>
        </TitleContainer>
        <TagsContainer>
          {categories?.map(category => (
            <CategoryTag
              key={category}
              category={category === 'api' ? 'API' : startCase(category)}
              priority={category === publishStatus}
            />
          ))}
        </TagsContainer>
      </FlexContainer>
      {alertText && (
        <AlertContainer>
          <Alert.Container>
            <Alert
              type="warning"
              showIcon
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

const FlexContainer = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(2)};
`;

const TitleContainer = styled('div')`
  flex: 1;
  padding: 0 16px;
  white-space: nowrap;
`;

const TagsContainer = styled('div')`
  flex: 3;
  text-align: right;
  padding: 0 ${space(2)};
`;

const IntegrationName = styled(Link)`
  font-weight: ${p => p.theme.fontWeightBold};
`;

const IntegrationDetails = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledLink = styled(Link)`
  color: ${p => p.theme.gray300};
  &:before {
    content: '|';
    color: ${p => p.theme.gray200};
    margin-right: ${space(0.75)};
  }
`;

const LearnMore = styled(Link)`
  color: ${p => p.theme.gray300};
`;

type PublishStatusProps = {status: SentryApp['status']; theme?: any};

const PublishStatus = styled(({status, ...props}: PublishStatusProps) => (
  <div {...props}>{status}</div>
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
    font-weight: ${p => p.theme.fontWeightNormal};
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
  display: inline-block;
  padding: 1px 10px;
  background: ${p => (p.priority ? p.theme.purple200 : p.theme.gray100)};
  border-radius: 20px;
  font-size: ${space(1.5)};
  margin: ${space(0.25)} ${space(0.5)};
  line-height: ${space(3)};
  text-align: center;
  color: ${p => (p.priority ? p.theme.white : p.theme.gray500)};
`;

const ResolveNowButton = styled(LinkButton)`
  color: ${p => p.theme.subText};
  float: right;
`;

export default IntegrationRow;
