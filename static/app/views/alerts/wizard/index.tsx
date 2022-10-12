import {Component, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import CreateAlertButton from 'sentry/components/createAlertButton';
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
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import withProjects from 'sentry/utils/withProjects';
import BuilderBreadCrumbs from 'sentry/views/alerts/builder/builderBreadCrumbs';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {AlertRuleType} from 'sentry/views/alerts/types';

import {
  AlertType,
  AlertWizardAlertNames,
  AlertWizardRuleTemplates,
  getAlertWizardCategories,
  WizardRuleTemplate,
} from './options';
import {AlertWizardPanelContent} from './panelContent';
import RadioPanelGroup from './radioPanelGroup';

type RouteParams = {
  orgId: string;
  projectId?: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  projectId: string;
  projects: Project[];
};

type State = {
  alertOption: AlertType;
};

const DEFAULT_ALERT_OPTION = 'issues';

class AlertWizard extends Component<Props, State> {
  state: State = {
    alertOption:
      this.props.location.query.alert_option in AlertWizardAlertNames
        ? this.props.location.query.alert_option
        : DEFAULT_ALERT_OPTION,
  };

  componentDidMount() {
    // capture landing on the alert wizard page and viewing the issue alert by default
    this.trackView();
  }

  trackView(alertType: AlertType = DEFAULT_ALERT_OPTION) {
    const {organization} = this.props;
    trackAdvancedAnalyticsEvent('alert_wizard.option_viewed', {
      organization,
      alert_type: alertType,
    });
  }

  handleChangeAlertOption = (alertOption: AlertType) => {
    this.setState({alertOption});
    this.trackView(alertOption);
  };

  renderCreateAlertButton() {
    const {organization, location, params, projectId: _projectId} = this.props;
    const {alertOption} = this.state;
    const projectId = params.projectId ?? _projectId;
    let metricRuleTemplate: Readonly<WizardRuleTemplate> | undefined =
      AlertWizardRuleTemplates[alertOption];
    const isMetricAlert = !!metricRuleTemplate;
    const isTransactionDataset = metricRuleTemplate?.dataset === Dataset.TRANSACTIONS;

    if (
      organization.features.includes('alert-crash-free-metrics') &&
      metricRuleTemplate?.dataset === Dataset.SESSIONS
    ) {
      metricRuleTemplate = {...metricRuleTemplate, dataset: Dataset.METRICS};
    }

    const to = {
      pathname: `/organizations/${organization.slug}/alerts/new/${
        isMetricAlert ? AlertRuleType.METRIC : AlertRuleType.ISSUE
      }/`,
      query: {
        ...(metricRuleTemplate ? metricRuleTemplate : {}),
        project: projectId,
        referrer: location?.query?.referrer,
      },
    };

    const renderNoAccess = p => (
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
              trackAdvancedAnalyticsEvent('alert_wizard.option_selected', {
                organization,
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
    const {organization, params, projectId: _projectId, routes, location} = this.props;
    const {alertOption} = this.state;
    const projectId = params.projectId ?? _projectId;
    const title = t('Alert Creation Wizard');
    const panelContent = AlertWizardPanelContent[alertOption];
    return (
      <Fragment>
        <SentryDocumentTitle title={title} projectSlug={projectId} />

        <Layout.Header>
          <StyledHeaderContent>
            <BuilderBreadCrumbs
              organization={organization}
              projectSlug={projectId}
              title={t('Select Alert')}
              routes={routes}
              location={location}
              canChangeProject
            />
            <Layout.Title>{t('Select Alert')}</Layout.Title>
          </StyledHeaderContent>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>
            <WizardBody>
              <WizardOptions>
                <CategoryTitle>{t('Errors')}</CategoryTitle>
                {getAlertWizardCategories(organization).map(
                  ({categoryHeading, options}, i) => (
                    <OptionsWrapper key={categoryHeading}>
                      {i > 0 && <CategoryTitle>{categoryHeading} </CategoryTitle>}
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
        </Layout.Body>
      </Fragment>
    );
  }
}

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
  a:not(:last-child) {
    margin-right: ${space(1)};
  }
`;

export default withProjects(AlertWizard);
