import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {t, tct} from 'app/locale';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'app/components/panels';
import {Client} from 'app/api';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import ExternalLink from 'app/components/links/externalLink';
import Button from 'app/components/button';
import {Organization, Project} from 'app/types';

import {defaultSuggestions as sourceDefaultSuggestions} from './form/sourceFieldSuggestions';
import Dialog from './dialog';
import Content from './content';
import Form from './form/form';
import OrganizationRules from './organizationRules';
import {Rule, EventIdStatus} from './types';
import convertRelayPiiConfig from './convertRelayPiiConfig';
import getRelayPiiConfig from './getRelayPiiConfig';

const ADVANCED_DATASCRUBBING_LINK =
  'https://docs.sentry.io/data-management/advanced-datascrubbing/';

type FormProps = React.ComponentProps<typeof Form>;
type DialogProps = React.ComponentProps<typeof Dialog>;
type SourceSuggestions = DialogProps['sourceSuggestions'];
type Errors = FormProps['errors'];

type Props = {
  endpoint: string;
  organization: Organization;
  onSubmitSuccess: (resp: Organization | Project) => void;
  projectId?: Project['id'];
  relayPiiConfig?: string;
  additionalContext?: React.ReactNode;
  disabled?: boolean;
};

type State = {
  rules: Array<Rule>;
  savedRules: Array<Rule>;
  relayPiiConfig?: string;
  sourceSuggestions: SourceSuggestions;
  eventId: DialogProps['eventId'];
  orgRules: Array<Rule>;
  showAddRuleModal?: boolean;
  isProjectLevel?: boolean;
};

class DataScrubbing extends React.Component<Props, State> {
  state: State = {
    rules: [],
    savedRules: [],
    relayPiiConfig: this.props.relayPiiConfig,
    sourceSuggestions: [],
    eventId: {
      value: '',
    },
    orgRules: [],
    isProjectLevel: this.props.endpoint.includes('projects'),
  };

  componentDidMount() {
    this.loadRules();
    this.loadSourceSuggestions();
    this.loadOrganizationRules();
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (prevState.relayPiiConfig !== this.state.relayPiiConfig) {
      this.loadRules();
    }
  }

  componentWillUnmount() {
    this.api.clear();
  }

  api = new Client();

  loadOrganizationRules = () => {
    const {isProjectLevel} = this.state;
    const {organization} = this.props;

    if (isProjectLevel) {
      try {
        const convertedRules = convertRelayPiiConfig(organization.relayPiiConfig);
        this.setState({
          orgRules: convertedRules,
        });
      } catch {
        addErrorMessage(t('Unable to load organization rules'));
      }
    }
  };

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

  loadSourceSuggestions = async () => {
    const {organization, projectId} = this.props;
    const {eventId} = this.state;

    if (!eventId.value) {
      this.setState(prevState => ({
        sourceSuggestions: sourceDefaultSuggestions,
        eventId: {
          ...prevState.eventId,
          status: undefined,
        },
      }));
      return;
    }

    this.setState(prevState => ({
      sourceSuggestions: sourceDefaultSuggestions,
      eventId: {
        ...prevState.eventId,
        status: EventIdStatus.LOADING,
      },
    }));

    try {
      const query: {projectId?: string; eventId: string} = {eventId: eventId.value};
      if (projectId) {
        query.projectId = projectId;
      }
      const rawSuggestions = await this.api.requestPromise(
        `/organizations/${organization.slug}/data-scrubbing-selector-suggestions/`,
        {query}
      );
      const sourceSuggestions: SourceSuggestions = rawSuggestions.suggestions;

      if (sourceSuggestions && sourceSuggestions.length > 0) {
        this.setState(prevState => ({
          sourceSuggestions,
          eventId: {
            ...prevState.eventId,
            status: EventIdStatus.LOADED,
          },
        }));
        return;
      }

      this.setState(prevState => ({
        sourceSuggestions: sourceDefaultSuggestions,
        eventId: {
          ...prevState.eventId,
          status: EventIdStatus.NOT_FOUND,
        },
      }));
    } catch {
      this.setState(prevState => ({
        eventId: {
          ...prevState.eventId,
          status: EventIdStatus.ERROR,
        },
      }));
    }
  };

  handleSubmit = async (rules: Array<Rule>) => {
    const {endpoint, onSubmitSuccess} = this.props;

    const errors: Errors = {};

    const relayPiiConfig = getRelayPiiConfig(rules);

    return await this.api
      .requestPromise(endpoint, {
        method: 'PUT',
        data: {relayPiiConfig},
      })
      .then(result => {
        onSubmitSuccess(result);
        this.setState({relayPiiConfig});
      })
      .then(() => {
        addSuccessMessage(t('Successfully saved data scrubbing rule'));
        return undefined;
      })
      .catch(error => {
        const errorMessage = error.responseJSON?.relayPiiConfig?.[0];

        if (!errorMessage) {
          addErrorMessage(t('Unknown error occurred while saving data scrubbing rule'));
          return undefined;
        }

        if (errorMessage.startsWith('invalid selector: ')) {
          for (const line of errorMessage.split('\n')) {
            if (line.startsWith('1 | ')) {
              const selector = line.slice(3);
              errors.source = t('Invalid source value: %s', selector);
              break;
            }
          }
          return {
            errors,
          };
        }

        if (errorMessage.startsWith('regex parse error:')) {
          for (const line of errorMessage.split('\n')) {
            if (line.startsWith('error:')) {
              const regex = line.slice(6).replace(/at line \d+ column \d+/, '');
              errors.customRegularExpression = t('Invalid regex: %s', regex);
              break;
            }
          }
          return {
            errors,
          };
        }

        addErrorMessage(t('Unknown error occurred while saving data scrubbing rule'));
        return undefined;
      });
  };

  handleAddRule = async (rule: Rule) => {
    const newRule = {
      ...rule,
      id: this.state.rules.length,
    };

    const rules = [...this.state.rules, newRule];

    return await this.handleSubmit(rules).then(result => {
      if (!result) {
        this.setState({
          rules,
        });
        return undefined;
      }
      return result;
    });
  };

  handleUpdateRule = async (updatedRule: Rule) => {
    const rules = this.state.rules.map(rule => {
      if (rule.id === updatedRule.id) {
        return updatedRule;
      }
      return rule;
    });

    return await this.handleSubmit(rules).then(result => {
      if (!result) {
        this.setState({
          rules,
        });
        return undefined;
      }
      return result;
    });
  };

  handleDeleteRule = async (rulesToBeDeleted: Array<Rule['id']>) => {
    const rules = this.state.rules.filter(rule => !rulesToBeDeleted.includes(rule.id));
    await this.handleSubmit(rules).then(result => {
      if (!result) {
        this.setState({
          rules,
        });
      }
    });
  };

  handleToggleAddRuleModal = (showAddRuleModal: boolean) => () => {
    this.setState({
      showAddRuleModal,
    });
  };

  handleUpdateEventId = (eventId: string) => {
    this.setState(
      {
        eventId: {
          value: eventId,
        },
      },
      this.loadSourceSuggestions
    );
  };

  render() {
    const {additionalContext, disabled} = this.props;
    const {
      rules,
      sourceSuggestions,
      showAddRuleModal,
      eventId,
      orgRules,
      isProjectLevel,
    } = this.state;

    return (
      <React.Fragment>
        <Panel>
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
            {isProjectLevel && <OrganizationRules rules={orgRules} />}
            <Content
              rules={rules}
              onDeleteRule={this.handleDeleteRule}
              onUpdateRule={this.handleUpdateRule}
              onUpdateEventId={this.handleUpdateEventId}
              eventId={eventId}
              sourceSuggestions={sourceSuggestions}
              disabled={disabled}
            />
            <PanelAction>
              <Button href={ADVANCED_DATASCRUBBING_LINK} target="_blank">
                {t('Read the docs')}
              </Button>
              <Button
                disabled={disabled}
                onClick={this.handleToggleAddRuleModal(true)}
                priority="primary"
              >
                {t('Add Rule')}
              </Button>
            </PanelAction>
          </PanelBody>
        </Panel>
        {showAddRuleModal && (
          <Dialog
            sourceSuggestions={sourceSuggestions}
            onSaveRule={this.handleAddRule}
            onClose={this.handleToggleAddRuleModal(false)}
            onUpdateEventId={this.handleUpdateEventId}
            eventId={eventId}
          />
        )}
      </React.Fragment>
    );
  }
}

export default DataScrubbing;

const PanelAction = styled('div')`
  padding: ${space(1)} ${space(2)};
  position: relative;
  display: grid;
  grid-gap: ${space(1)};
  grid-template-columns: auto auto;
  justify-content: flex-end;
  border-top: 1px solid ${p => p.theme.borderDark};
`;
