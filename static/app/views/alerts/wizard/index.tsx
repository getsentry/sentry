import {Component, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import CreateAlertButton from 'sentry/components/createAlertButton';
import FeatureBadge from 'sentry/components/featureBadge';
import {Hovercard} from 'sentry/components/hovercard';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import BuilderBreadCrumbs from 'sentry/views/alerts/builder/builderBreadCrumbs';
import {Dataset} from 'sentry/views/alerts/incidentRules/types';

import {
  AlertType,
  AlertWizardAlertNames,
  AlertWizardPanelContent,
  AlertWizardRuleTemplates,
  getAlertWizardCategories,
} from './options';
import RadioPanelGroup from './radioPanelGroup';

type RouteParams = {
  orgId: string;
  projectId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  project: Project;
};

type State = {
  alertOption: AlertType;
};

const DEFAULT_ALERT_OPTION = 'issues';

class AlertWizard extends Component<Props, State> {
  state: State = {
    alertOption: DEFAULT_ALERT_OPTION,
  };

  componentDidMount() {
    // capture landing on the alert wizard page and viewing the issue alert by default
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'alert_wizard.option_viewed',
      eventName: 'Alert Wizard: Option Viewed',
      organization_id: organization.id,
      alert_type: DEFAULT_ALERT_OPTION,
    });
  }

  handleChangeAlertOption = (alertOption: AlertType) => {
    const {organization} = this.props;
    this.setState({alertOption});
    trackAnalyticsEvent({
      eventKey: 'alert_wizard.option_viewed',
      eventName: 'Alert Wizard: Option Viewed',
      organization_id: organization.id,
      alert_type: alertOption,
    });
  };

  renderCreateAlertButton() {
    const {
      organization,
      location,
      params: {projectId},
    } = this.props;
    const {alertOption} = this.state;
    const metricRuleTemplate = AlertWizardRuleTemplates[alertOption];
    const isMetricAlert = !!metricRuleTemplate;
    const isTransactionDataset = metricRuleTemplate?.dataset === Dataset.TRANSACTIONS;

    const to = {
      pathname: `/organizations/${organization.slug}/alerts/${projectId}/new/`,
      query: {
        ...(metricRuleTemplate && metricRuleTemplate),
        createFromWizard: true,
        referrer: location?.query?.referrer,
      },
    };

    const noFeatureMessage = t('Requires incidents feature.');
    const renderNoAccess = p => (
      <Hovercard
        body={
          <FeatureDisabled
            features={p.features}
            hideHelpToggle
            message={noFeatureMessage}
            featureName={noFeatureMessage}
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
            ? ['incidents', 'performance-view']
            : isMetricAlert
            ? ['incidents']
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
              trackAnalyticsEvent({
                eventKey: 'alert_wizard.option_selected',
                eventName: 'Alert Wizard: Option Selected',
                organization_id: organization.id,
                alert_type: alertOption,
              })
            }
          >
            <CreateAlertButton
              organization={organization}
              projectSlug={projectId}
              disabled={!hasFeature}
              priority="primary"
              to={to}
              hideIcon
            >
              {t('Set Conditions')}
            </CreateAlertButton>
          </WizardButtonContainer>
        )}
      </Feature>
    );
  }

  render() {
    const {
      organization,
      params: {projectId},
      routes,
      location,
    } = this.props;
    const {alertOption} = this.state;
    const title = t('Alert Creation Wizard');
    const panelContent = AlertWizardPanelContent[alertOption];
    return (
      <Fragment>
        <SentryDocumentTitle title={title} projectSlug={projectId} />

        <Layout.Header>
          <StyledHeaderContent>
            <BuilderBreadCrumbs
              orgSlug={organization.slug}
              projectSlug={projectId}
              title={t('Select Alert')}
              routes={routes}
              location={location}
              canChangeProject
            />
            <Layout.Title>{t('Select Alert')}</Layout.Title>
          </StyledHeaderContent>
        </Layout.Header>
        <StyledLayoutBody>
          <Layout.Main fullWidth>
            <WizardBody>
              <WizardOptions>
                <CategoryTitle>{t('Errors')}</CategoryTitle>
                {getAlertWizardCategories(organization).map(
                  ({categoryHeading, options, featureBadgeType}, i) => (
                    <OptionsWrapper key={categoryHeading}>
                      {i > 0 && (
                        <CategoryTitle>
                          {categoryHeading}{' '}
                          {featureBadgeType && <FeatureBadge type={featureBadgeType} />}
                        </CategoryTitle>
                      )}
                      <RadioPanelGroup
                        choices={options.map(alertType => {
                          return [alertType, AlertWizardAlertNames[alertType]];
                        })}
                        onChange={this.handleChangeAlertOption}
                        value={alertOption}
                        label="alert-option"
                      />
                    </OptionsWrapper>
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
                  <WizardFooter>{this.renderCreateAlertButton()}</WizardFooter>
                </WizardPanelBody>
              </WizardPanel>
            </WizardBody>
          </Layout.Main>
        </StyledLayoutBody>
      </Fragment>
    );
  }
}

const StyledLayoutBody = styled(Layout.Body)`
  margin-bottom: -${space(3)};
`;

const StyledHeaderContent = styled(Layout.HeaderContent)`
  overflow: visible;
`;

const CategoryTitle = styled('h2')`
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-bottom: ${space(1)} !important;
`;

const WizardBody = styled('div')`
  display: flex;
  padding-top: ${space(1)};
`;

const WizardOptions = styled('div')`
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

const OptionsWrapper = styled('div')`
  margin-bottom: ${space(4)};

  &:last-child {
    margin-bottom: 0;
  }
`;

const WizardFooter = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(1.5)} ${space(1.5)} ${space(1.5)} ${space(1.5)};
`;

const WizardButtonContainer = styled('div')`
  display: flex;
  justify-content: flex-end;
`;

export default AlertWizard;
