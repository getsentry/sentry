import {Component} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'sentry/components/panels';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';

import Add from './modals/add';
import Edit from './modals/edit';
import Content from './content';
import convertRelayPiiConfig from './convertRelayPiiConfig';
import OrganizationRules from './organizationRules';
import submitRules from './submitRules';
import {ProjectId, Rule} from './types';

const ADVANCED_DATASCRUBBING_LINK =
  'https://docs.sentry.io/product/data-management-settings/scrubbing/advanced-datascrubbing/';

type Props<T extends ProjectId> = {
  endpoint: string;
  organization: Organization;
  additionalContext?: React.ReactNode;
  disabled?: boolean;
  onSubmitSuccess?: (data: T extends undefined ? Organization : Project) => void;
  projectId?: T;
  relayPiiConfig?: string;
};

type State = {
  orgRules: Array<Rule>;
  rules: Array<Rule>;
  savedRules: Array<Rule>;
  relayPiiConfig?: string;
};

class DataScrubbing<T extends ProjectId = undefined> extends Component<Props<T>, State> {
  state: State = {
    rules: [],
    savedRules: [],
    relayPiiConfig: this.props.relayPiiConfig,
    orgRules: [],
  };

  componentDidMount() {
    this.loadRules();
    this.loadOrganizationRules();
  }

  componentDidUpdate(_prevProps: Props<T>, prevState: State) {
    if (prevState.relayPiiConfig !== this.state.relayPiiConfig) {
      this.loadRules();
    }
  }

  componentWillUnmount() {
    this.api.clear();
  }

  api = new Client();

  loadOrganizationRules() {
    const {organization, projectId} = this.props;

    if (projectId) {
      try {
        this.setState({
          orgRules: convertRelayPiiConfig(organization.relayPiiConfig),
        });
      } catch {
        addErrorMessage(t('Unable to load organization rules'));
      }
    }
  }

  loadRules() {
    try {
      const convertedRules = convertRelayPiiConfig(this.state.relayPiiConfig);
      this.setState({
        rules: convertedRules,
        savedRules: convertedRules,
      });
    } catch {
      addErrorMessage(t('Unable to load project rules'));
    }
  }

  successfullySaved(
    response: T extends undefined ? Organization : Project,
    successMessage: string
  ) {
    const {onSubmitSuccess} = this.props;
    this.setState({rules: convertRelayPiiConfig(response.relayPiiConfig)});
    addSuccessMessage(successMessage);
    onSubmitSuccess?.(response);
  }

  handleOpenAddModal = () => {
    const {rules} = this.state;
    openModal(modalProps => (
      <Add
        {...modalProps}
        projectId={this.props.projectId}
        savedRules={rules}
        api={this.api}
        endpoint={this.props.endpoint}
        orgSlug={this.props.organization.slug}
        onSubmitSuccess={response => {
          this.successfullySaved(response, t('Successfully added data scrubbing rule'));
        }}
      />
    ));
  };

  handleOpenEditModal = (id: Rule['id']) => () => {
    const {rules} = this.state;
    openModal(modalProps => (
      <Edit
        {...modalProps}
        rule={rules[id]}
        projectId={this.props.projectId}
        savedRules={rules}
        api={this.api}
        endpoint={this.props.endpoint}
        orgSlug={this.props.organization.slug}
        onSubmitSuccess={response => {
          this.successfullySaved(response, t('Successfully updated data scrubbing rule'));
        }}
      />
    ));
  };

  handleDelete = (id: Rule['id']) => async () => {
    const {rules} = this.state;
    const filteredRules = rules.filter(rule => rule.id !== id);

    try {
      const data = await submitRules(this.api, this.props.endpoint, filteredRules);
      if (data?.relayPiiConfig) {
        const convertedRules = convertRelayPiiConfig(data.relayPiiConfig);

        this.setState({rules: convertedRules});
        addSuccessMessage(t('Successfully deleted data scrubbing rule'));
      }
    } catch {
      addErrorMessage(t('An unknown error occurred while deleting data scrubbing rule'));
    }
  };

  render() {
    const {additionalContext, disabled, projectId} = this.props;
    const {orgRules, rules} = this.state;

    return (
      <Panel data-test-id="advanced-data-scrubbing" id="advanced-data-scrubbing">
        <PanelHeader>
          <div>{t('Advanced Data Scrubbing')}</div>
        </PanelHeader>
        <PanelAlert type="info">
          {additionalContext}{' '}
          {`${t('The new rules will only apply to upcoming events. ')}`}{' '}
          {tct('For more details, see [linkToDocs].', {
            linkToDocs: (
              <ExternalLink href={ADVANCED_DATASCRUBBING_LINK}>
                {t('full documentation on data scrubbing')}
              </ExternalLink>
            ),
          })}
        </PanelAlert>
        <PanelBody>
          {projectId && <OrganizationRules rules={orgRules} />}
          <Content
            rules={rules}
            onDeleteRule={this.handleDelete}
            onEditRule={this.handleOpenEditModal}
            disabled={disabled}
          />
          <PanelAction>
            <Button href={ADVANCED_DATASCRUBBING_LINK} external>
              {t('Read Docs')}
            </Button>
            <Button
              disabled={disabled}
              onClick={this.handleOpenAddModal}
              priority="primary"
            >
              {t('Add Rule')}
            </Button>
          </PanelAction>
        </PanelBody>
      </Panel>
    );
  }
}

export default DataScrubbing;

const PanelAction = styled('div')`
  padding: ${space(1)} ${space(2)};
  position: relative;
  display: grid;
  gap: ${space(1)};
  grid-template-columns: auto auto;
  justify-content: flex-end;
  border-top: 1px solid ${p => p.theme.border};
`;
