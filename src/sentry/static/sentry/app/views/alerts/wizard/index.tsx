import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Feature from 'app/components/acl/feature';
import Badge from 'app/components/badge';
import CreateAlertButton from 'app/components/createAlertButton';
import ExternalLink from 'app/components/links/externalLink';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import PageHeading from 'app/components/pageHeading';
import {Panel, PanelBody} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
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
  WebVitalAlertTypes,
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
      />
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
        <PageContent>
          <Feature features={['organizations:alert-wizard']}>
            <BuilderBreadCrumbs
              hasMetricAlerts={hasMetricAlerts}
              orgSlug={organization.slug}
              projectSlug={projectId}
              title={t('Create Alert Rule')}
            />
            <StyledPageHeader>
              <PageHeading>{t('What do you want to alert on?')}</PageHeading>
            </StyledPageHeader>
            <Heading>{t('Errors')}</Heading>
            <WizardBody>
              <WizardOptions>
                {AlertWizardOptions.map(({categoryHeading, options}, i) => (
                  <OptionsWrapper key={categoryHeading}>
                    {i > 0 && <Heading>{categoryHeading}</Heading>}
                    <RadioPanelGroup
                      choices={options.map(alertType => {
                        return [
                          alertType,
                          AlertWizardAlertNames[alertType],
                          ...(WebVitalAlertTypes.has(alertType)
                            ? [<StyledBadge key={alertType} text={t('Web Vital')} />]
                            : []),
                        ] as [AlertType, string, React.ReactNode];
                      })}
                      onChange={this.handleChangeAlertOption}
                      value={alertOption}
                      label="alert-option"
                    />
                  </OptionsWrapper>
                ))}
              </WizardOptions>
              <WizardPanel visible={!!panelContent && !!alertOption}>
                {panelContent && alertOption && (
                  <WizardPanelBody>
                    <PageHeading>{AlertWizardAlertNames[alertOption]}</PageHeading>
                    <PanelDescription>
                      {panelContent.description}{' '}
                      {panelContent.docsLink && (
                        <ExternalLink href={panelContent.docsLink}>
                          {t('Learn more')}
                        </ExternalLink>
                      )}
                    </PanelDescription>
                    <Placeholder height="250px" />
                    <ExampleHeader>{t('Examples')}</ExampleHeader>
                    <List symbol="bullet">
                      {panelContent.examples.map((example, i) => (
                        <ExampleItem key={i}>{example}</ExampleItem>
                      ))}
                    </List>
                  </WizardPanelBody>
                )}
                {this.renderCreateAlertButton()}
              </WizardPanel>
            </WizardBody>
          </Feature>
        </PageContent>
      </React.Fragment>
    );
  }
}

const StyledPageHeader = styled(PageHeader)`
  margin-bottom: ${space(4)};
`;

const Heading = styled('h1')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: normal;
  margin-bottom: ${space(1)};
`;

const WizardBody = styled('div')`
  display: flex;
`;

const WizardOptions = styled('div')`
  flex: 3;
  margin-right: ${space(4)};
`;

const StyledBadge = styled(Badge)`
  color: ${p => p.theme.textColor};
  font-weight: normal;
`;

const WizardPanel = styled(Panel)<{visible?: boolean}>`
  padding: ${space(3)};
  flex: 5;
  display: flex;
  ${p => !p.visible && 'visibility: hidden'};
  flex-direction: column;
  align-items: start;
  align-self: flex-start;
`;

const WizardPanelBody = styled(PanelBody)`
  margin-bottom: ${space(2)};
  flex: 1;
`;

const PanelDescription = styled('div')`
  color: ${p => p.theme.subText};
  margin-bottom: ${space(2)};
`;

const ExampleHeader = styled('div')`
  margin: ${space(2)} 0;
  font-size: ${p => p.theme.fontSizeLarge};
`;

const ExampleItem = styled(ListItem)`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const OptionsWrapper = styled('div')`
  margin-bottom: ${space(4)};
`;

export default AlertWizard;
