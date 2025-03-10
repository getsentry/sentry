import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import startCase from 'lodash/startCase';

import Access from 'sentry/components/acl/access';
import {Flex} from 'sentry/components/container/flex';
import type {AlertProps} from 'sentry/components/core/alert';
import {Alert} from 'sentry/components/core/alert';
import {Tag} from 'sentry/components/core/badge/tag';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import {Tooltip} from 'sentry/components/tooltip';
import {IconClose} from 'sentry/icons/iconClose';
import {IconDocs} from 'sentry/icons/iconDocs';
import {IconGeneric} from 'sentry/icons/iconGeneric';
import {IconGithub} from 'sentry/icons/iconGithub';
import {IconProject} from 'sentry/icons/iconProject';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  IntegrationFeature,
  IntegrationInstallationStatus,
} from 'sentry/types/integrations';
import {getCategories, getIntegrationFeatureGate} from 'sentry/utils/integrationUtil';
import marked, {singleLineRenderer} from 'sentry/utils/marked';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import BreadcrumbTitle from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle';
import type {Tab} from 'sentry/views/settings/organizationIntegrations/abstractIntegrationDetailedView';
import {useIntegrationFeatures} from 'sentry/views/settings/organizationIntegrations/detailedView/useIntegrationFeatures';
import IntegrationStatus from 'sentry/views/settings/organizationIntegrations/integrationStatus';

interface AlertType extends AlertProps {
  text: string;
}

function TopSection({
  featureData,
  integrationName,
  installationStatus,
  integrationIcon,
  addInstallButton,
  additionalCTA,
}: {
  addInstallButton: React.ReactNode;
  additionalCTA: React.ReactNode;
  featureData: IntegrationFeature[];
  installationStatus: IntegrationInstallationStatus | null;
  integrationIcon: React.ReactNode;
  integrationName: string;
}) {
  const tags = getCategories(featureData);
  return (
    <TopSectionWrapper>
      <Flex>
        {integrationIcon}
        <NameContainer>
          <Flex align="center">
            <Name>{integrationName}</Name>
            <StatusWrapper>
              {installationStatus && <IntegrationStatus status={installationStatus} />}
            </StatusWrapper>
          </Flex>
          <Flex align="center">
            {tags.map(feature => (
              <StyledTag key={feature}>{startCase(feature)}</StyledTag>
            ))}
          </Flex>
        </NameContainer>
      </Flex>
      <Flex align="center">
        {addInstallButton}
        {additionalCTA}
      </Flex>
    </TopSectionWrapper>
  );
}

function Tabs({
  tabs,
  activeTab,
  onTabChange,
  getTabDisplay,
}: {
  activeTab: Tab;
  tabs: Tab[];
  getTabDisplay?: (tab: Tab) => string;
  onTabChange?: (tab: Tab) => void;
}) {
  // If getTabDisplay is not provided, use the tab as the display text
  const renderTab = useMemo(() => getTabDisplay ?? ((tab: Tab) => tab), [getTabDisplay]);
  return (
    <ul className="nav nav-tabs border-bottom" style={{paddingTop: '30px'}}>
      {tabs.map(tab => (
        <li
          key={tab}
          className={activeTab === tab ? 'active' : ''}
          onClick={() => onTabChange?.(tab)}
        >
          <CapitalizedLink>{renderTab(tab)}</CapitalizedLink>
        </li>
      ))}
    </ul>
  );
}

function Body({
  integrationName,
  alert,
  topSection,
  tabs,
  content,
}: {
  alert: React.ReactNode;
  content: React.ReactNode;
  integrationName: string;
  tabs: React.ReactNode;
  topSection: React.ReactNode;
}) {
  const routes = useRoutes();
  return (
    <Fragment>
      <BreadcrumbTitle routes={routes} title={integrationName} />
      {alert}
      {topSection}
      {tabs}
      {content}
    </Fragment>
  );
}

function EmptyConfigurations({action}: {action: React.ReactElement}) {
  return (
    <Panel>
      <EmptyMessage
        title={t("You haven't set anything up yet")}
        description={t(
          'But that doesn’t have to be the case for long! Add an installation to get started.'
        )}
        action={action}
      />
    </Panel>
  );
}

const DisabledNotice = styled(({reason, ...p}: {reason: React.ReactNode}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
    }}
    {...p}
  >
    <IconCloseCircle isCircled />
    <span>{reason}</span>
  </div>
))`
  padding-top: ${space(0.5)};
  font-size: 0.9em;
`;

function AddInstallButton({
  featureData,
  hideButtonIfDisabled,
  requiresAccess,
  renderTopButton,
}: {
  featureData: IntegrationFeature[];
  hideButtonIfDisabled: boolean;
  renderTopButton: (disabled: boolean, hasAccess: boolean) => React.ReactNode;
  requiresAccess: boolean;
}) {
  const organization = useOrganization();
  const features = useIntegrationFeatures({featureData});

  const {IntegrationFeatures} = getIntegrationFeatureGate();

  return (
    <IntegrationFeatures features={features} organization={organization}>
      {({disabled, disabledReason}) => (
        <DisableWrapper>
          <Access access={['org:integrations']}>
            {({hasAccess}) => (
              <Tooltip
                title={t(
                  'You must be an organization owner, manager or admin to install this.'
                )}
                disabled={hasAccess || !requiresAccess}
              >
                {!hideButtonIfDisabled && disabled ? (
                  <div />
                ) : (
                  renderTopButton(disabled, hasAccess)
                )}
              </Tooltip>
            )}
          </Access>
          {disabled && <IntegrationLayout.DisabledNotice reason={disabledReason} />}
        </DisableWrapper>
      )}
    </IntegrationFeatures>
  );
}

function InformationCard({
  description,
  featureData,
  integrationSlug,
  author,
  permissions = null,
  alerts = [],
  resourceLinks = [],
}: {
  description: string;
  featureData: IntegrationFeature[];
  integrationSlug: string;
  alerts?: AlertType[];
  author?: string;
  permissions?: React.ReactNode;
  resourceLinks?: Array<{title: string; url: string}>;
}) {
  const organization = useOrganization();
  const features = useIntegrationFeatures({featureData});

  const {FeatureList} = getIntegrationFeatureGate();

  return (
    <Fragment>
      <Flex align="center">
        <FlexContainer>
          <Description dangerouslySetInnerHTML={{__html: marked(description)}} />
          <FeatureList
            features={features}
            organization={organization}
            provider={{key: integrationSlug}}
          />
          {permissions}
          {alerts.map((alert, i) => (
            <Alert.Container key={i}>
              <Alert key={i} type={alert.type} showIcon>
                <span
                  dangerouslySetInnerHTML={{__html: singleLineRenderer(alert.text)}}
                />
              </Alert>
            </Alert.Container>
          ))}
        </FlexContainer>
        <Metadata>
          {author && (
            <AuthorInfo>
              <CreatedContainer>{t('Created By')}</CreatedContainer>
              <div>{author}</div>
            </AuthorInfo>
          )}
          {resourceLinks.map(({title, url}) => (
            <ExternalLinkContainer key={url}>
              <ResourceIcon title={title} />
              <ExternalLink href={url}>{title}</ExternalLink>
            </ExternalLinkContainer>
          ))}
        </Metadata>
      </Flex>
    </Fragment>
  );
}

function ResourceIcon({title}: {title: string}) {
  switch (title) {
    case 'View Source':
      return <IconProject />;
    case 'Report Issue':
      return <IconGithub />;
    case 'Documentation':
    case 'Splunk Setup Instructions':
    case 'Trello Setup Instructions':
      return <IconDocs />;
    default:
      return <IconGeneric />;
  }
}

const IntegrationLayout = {
  TopSection,
  Tabs,
  Body,
  EmptyConfigurations,
  DisabledNotice,
  AddInstallButton,
  InformationCard,
  ResourceIcon,
};

export default IntegrationLayout;

const TopSectionWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const NameContainer = styled('div')`
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  justify-content: center;
  padding-left: ${space(2)};
`;

const Name = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: 1.4em;
  margin-bottom: ${space(0.5)};
`;

const StatusWrapper = styled('div')`
  margin-bottom: ${space(0.5)};
  padding-left: ${space(2)};
`;

const StyledTag = styled(Tag)`
  text-transform: none;
  &:not(:first-child) {
    margin-left: ${space(0.5)};
  }
`;

const CapitalizedLink = styled('a')`
  text-transform: capitalize;
`;

const IconCloseCircle = styled(IconClose)`
  color: ${p => p.theme.dangerText};
  margin-right: ${space(1)};
`;

const DisableWrapper = styled('div')`
  margin-left: auto;
  align-self: center;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const FlexContainer = styled('div')`
  flex: 1;
`;

const Description = styled('div')`
  li {
    margin-bottom: 6px;
  }
`;

const Metadata = styled('div')`
  display: grid;
  grid-auto-rows: max-content;
  grid-auto-flow: row;
  gap: ${space(1)};
  font-size: 0.9em;
  margin-left: ${space(4)};
  margin-right: 100px;
  align-self: flex-start;
`;

const AuthorInfo = styled('div')`
  margin-bottom: ${space(3)};
`;

const CreatedContainer = styled('div')`
  text-transform: uppercase;
  padding-bottom: ${space(1)};
  color: ${p => p.theme.gray300};
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: 12px;
`;

const ExternalLinkContainer = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1)};
  align-items: center;
`;
