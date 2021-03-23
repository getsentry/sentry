import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Feature from 'app/components/acl/feature';
import CreateAlertButton from 'app/components/createAlertButton';
import PageHeading from 'app/components/pageHeading';
import {Panel, PanelBody} from 'app/components/panels';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import BuilderBreadCrumbs from 'app/views/alerts/builder/builderBreadCrumbs';
import RadioGroup from 'app/views/settings/components/forms/controls/radioGroup';

import {
  AlertType,
  AlertWizardDescriptions,
  AlertWizardOptions,
  AlertWizardRuleTemplates,
} from './options';

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
  alertOption: AlertType;
};
class AlertWizard extends React.Component<Props, State> {
  state: State = {
    alertOption: 'issues',
  };

  handleChangeAlertOption = (alertOption: AlertType) => {
    this.setState({alertOption});
  };

  renderCreateAlertButton() {
    const {organization, project, location} = this.props;
    const {alertOption} = this.state;
    const metricRuleTemplate = AlertWizardRuleTemplates[alertOption];
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

    return (
      <React.Fragment>
        <SentryDocumentTitle title={title} projectSlug={projectId} />
        <PageContent>
          <Feature features={['organizations:alert-wizard']}>
            <BuilderBreadCrumbs
              hasMetricAlerts={hasMetricAlerts}
              orgSlug={organization.slug}
              title={t('Create Alert Rule')}
            />
            <StyledPageHeader>
              <PageHeading>{t('What do you want to alert on?')}</PageHeading>
            </StyledPageHeader>
            <WizardBody>
              <WizardOptions>
                {AlertWizardOptions.map(({categoryHeading, options}) => (
                  <OptionsWrapper key={categoryHeading}>
                    <Heading>{categoryHeading}</Heading>
                    <RadioGroup
                      choices={options}
                      onChange={this.handleChangeAlertOption}
                      value={alertOption}
                      label="alert-option"
                    />
                  </OptionsWrapper>
                ))}
              </WizardOptions>
              <WizardPanel>
                <WizardPanelBody>{AlertWizardDescriptions[alertOption]}</WizardPanelBody>
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
`;

const WizardPanel = styled(Panel)`
  padding: ${space(3)};
  flex: 5;
  display: flex;
  flex-direction: column;
  align-items: start;
`;

const WizardPanelBody = styled(PanelBody)`
  flex: 1;
`;

const OptionsWrapper = styled('div')`
  margin-bottom: ${space(4)};
`;

export default AlertWizard;
