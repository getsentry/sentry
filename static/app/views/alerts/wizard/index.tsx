import {useState} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {ExternalLink} from 'sentry/components/core/link';
import CreateAlertButton from 'sentry/components/createAlertButton';
import Hook from 'sentry/components/hook';
import {Hovercard} from 'sentry/components/hovercard';
import * as Layout from 'sentry/components/layouts/thirds';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import HookStore from 'sentry/stores/hookStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import BuilderBreadCrumbs from 'sentry/views/alerts/builder/builderBreadCrumbs';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {AlertRuleType} from 'sentry/views/alerts/types';

import type {AlertType, MetricAlertType, WizardRuleTemplate} from './options';
import {
  AlertWizardAlertNames,
  AlertWizardExtraContent,
  AlertWizardRuleTemplates,
  getAlertWizardCategories,
} from './options';
import {AlertWizardPanelContent} from './panelContent';
import RadioPanelGroup from './radioPanelGroup';

interface AlertWizardProps {
  organization: Organization;
  projectId: string;
}

const DEFAULT_ALERT_OPTION = 'issues';

function AlertWizard({organization, projectId}: AlertWizardProps) {
  const location = useLocation();
  const params = useParams<{projectId?: string}>();
  const useMetricDetectorLimit =
    HookStore.get('react-hook:use-metric-detector-limit')[0] ?? (() => null);
  const quota = useMetricDetectorLimit();
  const canCreateMetricAlert = !quota?.hasReachedLimit;

  const alertOptionQuery = location.query.alert_option as AlertType | undefined;
  const [alertOption, setAlertOption] = useState<AlertType>(
    alertOptionQuery && alertOptionQuery in AlertWizardAlertNames
      ? alertOptionQuery
      : DEFAULT_ALERT_OPTION
  );
  const projectSlug = params.projectId ?? projectId;

  const handleChangeAlertOption = (option: AlertType) => {
    setAlertOption(option);
  };

  let metricRuleTemplate: Readonly<WizardRuleTemplate> | undefined =
    alertOption in AlertWizardRuleTemplates
      ? AlertWizardRuleTemplates[alertOption as MetricAlertType]
      : undefined;
  const isMetricAlert = !!metricRuleTemplate;

  function renderCreateAlertButton() {
    const isTransactionDataset = metricRuleTemplate?.dataset === Dataset.TRANSACTIONS;

    // If theres anything using the legacy sessions dataset, we need to convert it to metrics
    if (metricRuleTemplate?.dataset === Dataset.SESSIONS) {
      metricRuleTemplate = {...metricRuleTemplate, dataset: Dataset.METRICS};
    }

    if (metricRuleTemplate?.dataset === Dataset.ERRORS) {
      // Pre-fill is:unresolved for error metric alerts
      // Filters out events in issues that are archived or resolved
      metricRuleTemplate = {...metricRuleTemplate, query: 'is:unresolved'};
    }

    const renderNoAccess = (p: any) => (
      <Hovercard
        body={
          <FeatureDisabled
            features={p.features}
            hideHelpToggle
            featureName={t('Metric Alerts')}
          />
        }
      >
        {p.children(p)}
      </Hovercard>
    );

    return (
      <Feature
        features={
          isTransactionDataset
            ? ['organizations:incidents', 'organizations:performance-view']
            : isMetricAlert
              ? ['organizations:incidents']
              : []
        }
        requireAll
        organization={organization}
        hookName="feature-disabled:alert-wizard-performance"
        renderDisabled={renderNoAccess}
      >
        {({hasFeature}) => (
          <WizardButtonContainer
            onClick={() =>
              trackAnalytics('alert_wizard.option_selected', {
                organization,
                alert_type: alertOption,
              })
            }
          >
            <CreateAlertButton
              organization={organization}
              projectSlug={projectSlug}
              disabled={!hasFeature || (isMetricAlert && !canCreateMetricAlert)}
              priority="primary"
              to={{
                pathname: makeAlertsPathname({
                  organization,
                  path: `/new/${
                    isMetricAlert
                      ? AlertRuleType.METRIC
                      : alertOption === 'uptime_monitor'
                        ? AlertRuleType.UPTIME
                        : alertOption === 'crons_monitor'
                          ? AlertRuleType.CRONS
                          : AlertRuleType.ISSUE
                  }/`,
                }),
                query: {
                  ...(metricRuleTemplate ? metricRuleTemplate : {}),
                  project: projectSlug,
                  referrer: location?.query?.referrer,
                },
              }}
              hideIcon
            >
              {t('Set Conditions')}
            </CreateAlertButton>
          </WizardButtonContainer>
        )}
      </Feature>
    );
  }

  const panelContent = AlertWizardPanelContent[alertOption];
  return (
    <Layout.Page>
      <SentryDocumentTitle title={t('Alert Creation Wizard')} projectSlug={projectSlug} />

      <Layout.Header>
        <StyledHeaderContent>
          <BuilderBreadCrumbs
            organization={organization}
            projectSlug={projectSlug}
            title={t('Select Alert')}
          />
          <Layout.Title>{t('Select Alert')}</Layout.Title>
        </StyledHeaderContent>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main width="full">
          <WizardBody>
            <WizardOptions>
              {getAlertWizardCategories(organization).map(
                ({categoryHeading, options}: any) => (
                  <div key={categoryHeading}>
                    <CategoryTitle>{categoryHeading} </CategoryTitle>
                    <WizardGroupedOptions
                      choices={options.map((alertType: MetricAlertType) => {
                        const optionIsMetricAlert = alertType in AlertWizardRuleTemplates;

                        return {
                          id: alertType,
                          name: AlertWizardAlertNames[alertType],
                          badge: AlertWizardExtraContent[alertType],
                          trailingContent: optionIsMetricAlert ? (
                            <Hook name="component:metric-alert-quota-icon" />
                          ) : null,
                        };
                      })}
                      onChange={option => handleChangeAlertOption(option as AlertType)}
                      value={alertOption}
                      label="alert-option"
                    />
                  </div>
                )
              )}
            </WizardOptions>
            <WizardPanel visible={!!panelContent && !!alertOption}>
              <WizardPanelBody>
                <div>
                  <PanelHeader>{AlertWizardAlertNames[alertOption]}</PanelHeader>
                  <PanelBody withPadding>
                    <PanelDescription>
                      {panelContent.description}{' '}
                      {panelContent.docsLink && (
                        <ExternalLink href={panelContent.docsLink}>
                          {t('Learn more')}
                        </ExternalLink>
                      )}
                    </PanelDescription>
                    <WizardImage src={panelContent.illustration} />
                    <ExampleHeader>{t('Examples')}</ExampleHeader>
                    <ExampleList symbol="bullet">
                      {panelContent.examples.map((example, i) => (
                        <ExampleItem key={i}>{example}</ExampleItem>
                      ))}
                    </ExampleList>
                  </PanelBody>
                </div>
                <WizardFooter>{renderCreateAlertButton()}</WizardFooter>
                {isMetricAlert && (
                  <DisabledAlertMessageContainer>
                    <Hook name="component:metric-alert-quota-message" />
                  </DisabledAlertMessageContainer>
                )}
              </WizardPanelBody>
            </WizardPanel>
          </WizardBody>
        </Layout.Main>
      </Layout.Body>
    </Layout.Page>
  );
}

const StyledHeaderContent = styled(Layout.HeaderContent)`
  overflow: visible;
`;

const CategoryTitle = styled('h2')`
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.xl};
  margin-bottom: ${space(1)} !important;
`;

const WizardBody = styled('div')`
  display: flex;
  padding-top: ${space(1)};
`;

const WizardOptions = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(4)};
  flex: 3;
  margin-right: ${space(3)};
  padding-right: ${space(3)};
  max-width: 300px;
`;

const WizardImage = styled('img')`
  max-height: 300px;
  margin-bottom: ${space(2)};
`;

const WizardPanel = styled(Panel)<{visible?: boolean}>`
  max-width: 700px;
  position: sticky;
  top: 20px;
  flex: 5;
  display: flex;
  ${p => !p.visible && 'visibility: hidden'};
  flex-direction: column;
  align-items: start;
  align-self: flex-start;
  ${p => p.visible && 'animation: 0.6s pop ease forwards'};

  @keyframes pop {
    0% {
      transform: translateY(30px);
      opacity: 0;
    }
    100% {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;

const ExampleList = styled(List)`
  margin-bottom: ${space(2)} !important;
`;

const WizardPanelBody = styled(PanelBody)`
  flex: 1;
  min-width: 100%;
`;

const PanelDescription = styled('p')`
  margin-bottom: ${space(2)};
`;

const ExampleHeader = styled('div')`
  margin: 0 0 ${space(1)} 0;
  font-size: ${p => p.theme.fontSize.lg};
`;

const ExampleItem = styled(ListItem)`
  font-size: ${p => p.theme.fontSize.md};
`;

const WizardFooter = styled('div')`
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  padding: ${space(1.5)} ${space(1.5)} ${space(1.5)} ${space(1.5)};
`;

const WizardButtonContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
  a:not(:last-child) {
    margin-right: ${space(1)};
  }
`;

const WizardGroupedOptions = styled(RadioPanelGroup)`
  label {
    grid-template-columns: repeat(3, max-content);
  }
`;

const DisabledAlertMessageContainer = styled('div')`
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  background-color: ${p => p.theme.tokens.background.secondary};
  color: ${p => p.theme.tokens.content.secondary};
  border-radius: 0 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md};
`;

export default AlertWizard;
