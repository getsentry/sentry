import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Feature from 'app/components/acl/feature';
import CreateAlertButton from 'app/components/createAlertButton';
import * as Layout from 'app/components/layouts/thirds';
import ExternalLink from 'app/components/links/externalLink';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import BuilderBreadCrumbs from 'app/views/alerts/builder/builderBreadCrumbs';
import {Dataset} from 'app/views/settings/incidentRules/types';

import {
  AlertType,
  AlertWizardAlertNames,
  AlertWizardOptions,
  AlertWizardPanelContent,
  AlertWizardRuleTemplates,
} from './options';
import RadioPanelGroup from './radioPanelGroup';

type RouteParams = {
  orgId: string;
  projectId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  project: Project;
  hasMetricAlerts: boolean;
};

type State = {
  alertOption: AlertType | null;
};
class AlertWizard extends React.Component<Props, State> {
  state: State = {
    alertOption: null,
  };

  handleChangeAlertOption = (alertOption: AlertType) => {
    this.setState({alertOption});
  };

  renderCreateAlertButton() {
    const {organization, project, location} = this.props;
    const {alertOption} = this.state;
    const metricRuleTemplate = alertOption && AlertWizardRuleTemplates[alertOption];
    const disabled =
      !organization.features.includes('performance-view') &&
      metricRuleTemplate?.dataset === Dataset.TRANSACTIONS;

    const to = {
      pathname: `/organizations/${organization.slug}/alerts/${project.slug}/new/`,
      query: {
        ...(metricRuleTemplate && metricRuleTemplate),
        createFromWizard: true,
        referrer: location?.query?.referrer,
      },
    };
    return (
      <CreateAlertButton
        organization={organization}
        projectSlug={project.slug}
        priority="primary"
        to={to}
        disabled={disabled}
        hideIcon
      >
        {t('Set Conditions')}
      </CreateAlertButton>
    );
  }

  render() {
    const {
      hasMetricAlerts,
      organization,
      params: {projectId},
    } = this.props;
    const {alertOption} = this.state;
    const title = t('Alert Creation Wizard');
    const panelContent = alertOption && AlertWizardPanelContent[alertOption];
    return (
      <React.Fragment>
        <SentryDocumentTitle title={title} projectSlug={projectId} />

        <Feature features={['organizations:alert-wizard']}>
          <Layout.Header>
            <Layout.HeaderContent>
              <BuilderBreadCrumbs
                hasMetricAlerts={hasMetricAlerts}
                orgSlug={organization.slug}
                projectSlug={projectId}
                title={t('Create Alert Rule')}
              />
              <Layout.Title>{t('Select Alert Type')}</Layout.Title>
            </Layout.HeaderContent>
          </Layout.Header>
          <StyledLayoutBody>
            <Layout.Main fullWidth>
              <List symbol="colored-numeric">
                <StyledListItem>{t('What should we alert you about?')}</StyledListItem>
                <WizardBody>
                  <WizardOptions>
                    <Styledh2>{t('Errors')}</Styledh2>
                    {AlertWizardOptions.map(({categoryHeading, options}, i) => (
                      <OptionsWrapper key={categoryHeading}>
                        {i > 0 && <Styledh2>{categoryHeading}</Styledh2>}
                        <RadioPanelGroup
                          choices={options.map(alertType => {
                            return [alertType, AlertWizardAlertNames[alertType]] as [
                              string,
                              React.ReactNode
                            ];
                          })}
                          onChange={this.handleChangeAlertOption}
                          value={alertOption}
                          label="alert-option"
                        />
                      </OptionsWrapper>
                    ))}
                  </WizardOptions>
                  <WizardPanel visible={!!panelContent && !!alertOption}>
                    <WizardPanelBody>
                      {panelContent && alertOption && (
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
                      )}
                      <WizardButton>{this.renderCreateAlertButton()}</WizardButton>
                    </WizardPanelBody>
                  </WizardPanel>
                </WizardBody>
              </List>
            </Layout.Main>
          </StyledLayoutBody>
        </Feature>
      </React.Fragment>
    );
  }
}

const StyledLayoutBody = styled(Layout.Body)`
  margin-bottom: -20px;
`;

const StyledListItem = styled(ListItem)`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin-top: ${space(3)};
  margin-bottom: ${space(3)};
  max-width: 350px;
`;

const Styledh2 = styled('h2')`
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: ${space(1)} !important;
`;

const WizardBody = styled('div')`
  display: flex;
`;

const WizardOptions = styled('div')`
  flex: 3;
  margin-left: ${space(4)};
  margin-right: ${space(3)};
  padding-right: ${space(3)};
  max-width: 300px;
`;

const WizardImage = styled('img')`
  max-height: 300px;
`;

const WizardPanel = styled(Panel)<{visible?: boolean}>`
  margin-top: -50px;
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
  margin-bottom: 0;
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

const WizardButton = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(1.5)} ${space(1.5)} ${space(1.5)} ${space(1.5)};
`;

export default AlertWizard;
