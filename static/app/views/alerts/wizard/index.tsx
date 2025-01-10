import {useState} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import CreateAlertButton from 'sentry/components/createAlertButton';
import {Hovercard} from 'sentry/components/hovercard';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import BuilderBreadCrumbs from 'sentry/views/alerts/builder/builderBreadCrumbs';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {AlertRuleType} from 'sentry/views/alerts/types';

import type {AlertType, WizardRuleTemplate} from './options';
import {
  AlertWizardAlertNames,
  AlertWizardExtraContent,
  AlertWizardRuleTemplates,
  getAlertWizardCategories,
} from './options';
import {AlertWizardPanelContent} from './panelContent';
import RadioPanelGroup from './radioPanelGroup';

type RouteParams = {
  projectId?: string;
};

type AlertWizardProps = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  projectId: string;
};

const DEFAULT_ALERT_OPTION = 'issues';

function AlertWizard({organization, params, location, projectId}: AlertWizardProps) {
  const [alertOption, setAlertOption] = useState<AlertType>(
    location.query.alert_option in AlertWizardAlertNames
      ? location.query.alert_option
      : DEFAULT_ALERT_OPTION
  );
  const projectSlug = params.projectId ?? projectId;

  const handleChangeAlertOption = (option: AlertType) => {
    setAlertOption(option);
  };

  function renderCreateAlertButton() {
    let metricRuleTemplate: Readonly<WizardRuleTemplate> | undefined =
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      AlertWizardRuleTemplates[alertOption];
    const isMetricAlert = !!metricRuleTemplate;
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
              disabled={!hasFeature}
              priority="primary"
              to={{
                pathname: `/organizations/${organization.slug}/alerts/new/${
                  isMetricAlert
                    ? AlertRuleType.METRIC
                    : alertOption === 'uptime_monitor'
                      ? AlertRuleType.UPTIME
                      : AlertRuleType.ISSUE
                }/`,
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
        <Layout.Main fullWidth>
          <WizardBody>
            <WizardOptions>
              {getAlertWizardCategories(organization).map(
                ({categoryHeading, options}: any) => (
                  <div key={categoryHeading}>
                    <CategoryTitle>{categoryHeading} </CategoryTitle>
                    <WizardGroupedOptions
                      choices={options.map((alertType: any) => {
                        return [
                          alertType,
                          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                          AlertWizardAlertNames[alertType],
                          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                          AlertWizardExtraContent[alertType],
                        ];
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
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeExtraLarge};
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
  font-size: ${p => p.theme.fontSizeLarge};
`;

const ExampleItem = styled(ListItem)`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const WizardFooter = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
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

export default AlertWizard;
