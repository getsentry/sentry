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

<<<<<<< HEAD:src/sentry/static/sentry/app/views/settings/components/dataScrubbing/index.tsx
import {defaultSuggestions as sourceDefaultSuggestions} from './form/sourceFieldSuggestions';
import Dialog from './dialog';
import Content from './content';
import Form from './form/form';
=======
import Dialog from './dialog';
import Content from './content';
>>>>>>> ref(pii): Updated save logic:src/sentry/static/sentry/app/views/settings/components/dataPrivacyRules/dataPrivacyRules.tsx
import OrganizationRules from './organizationRules';
import submitRules from './submitRules';
import handleError from './handleError';
import convertRelayPiiConfig from './convertRelayPiiConfig';
import {
  Rule,
  EventIdStatus,
  EventId,
  SourceSuggestion,
  RequestError,
  Errors,
} from './types';

const ADVANCED_DATASCRUBBING_LINK =
  'https://docs.sentry.io/data-management/advanced-datascrubbing/';

<<<<<<< HEAD:src/sentry/static/sentry/app/views/settings/components/dataScrubbing/index.tsx
type FormProps = React.ComponentProps<typeof Form>;
type DialogProps = React.ComponentProps<typeof Dialog>;
type SourceSuggestions = DialogProps['sourceSuggestions'];
type Errors = FormProps['errors'];

=======
>>>>>>> ref(pii): Updated save logic:src/sentry/static/sentry/app/views/settings/components/dataPrivacyRules/dataPrivacyRules.tsx
type Props = {
  endpoint: string;
  organization: Organization;
  onSubmitSuccess: (data: any) => void;
  projectId?: Project['id'];
  relayPiiConfig?: string;
  additionalContext?: React.ReactNode;
  disabled?: boolean;
};

type State = {
  rules: Array<Rule>;
  savedRules: Array<Rule>;
<<<<<<< HEAD:src/sentry/static/sentry/app/views/settings/components/dataScrubbing/index.tsx
  relayPiiConfig?: string;
  sourceSuggestions: SourceSuggestions;
  eventId: DialogProps['eventId'];
=======
  sourceSuggestions: Array<SourceSuggestion>;
  eventId: EventId;
>>>>>>> ref(pii): Updated save logic:src/sentry/static/sentry/app/views/settings/components/dataPrivacyRules/dataPrivacyRules.tsx
  orgRules: Array<Rule>;
  errors: Errors;
  showAddRuleModal?: boolean;
  isProjectLevel?: boolean;
  relayPiiConfig?: string;
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
    errors: {},
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
    if (prevState.eventId.value !== this.state.eventId.value) {
      this.loadSourceSuggestions();
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
        this.setState({
          orgRules: convertRelayPiiConfig(organization.relayPiiConfig),
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

      const sourceSuggestions: Array<SourceSuggestion> = rawSuggestions.suggestions;

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

  convertRequestError = (error: ReturnType<typeof handleError>) => {
    switch (error.type) {
      case RequestError.InvalidSelector:
        this.setState(prevState => ({
          errors: {
            ...prevState.errors,
            source: error.message,
          },
        }));
        break;
      case RequestError.RegexParse:
        this.setState(prevState => ({
          errors: {
            ...prevState.errors,
            customRegex: error.message,
          },
        }));
        break;
      default:
        addErrorMessage(error.message);
    }
  };

  handleSave = async (rules: Array<Rule>, successMessage: string) => {
    const {endpoint, onSubmitSuccess} = this.props;
    try {
      const data = await submitRules(this.api, endpoint, rules);
      if (data?.relayPiiConfig) {
        const convertedRules = convertRelayPiiConfig(data.relayPiiConfig);
        this.setState({rules: convertedRules});
        addSuccessMessage(successMessage);
        onSubmitSuccess(data);
      }
    } catch (error) {
      this.convertRequestError(handleError(error));
    }
  };

  handleAddRule = (rule: Rule) => {
    const newRule = {...rule, id: this.state.rules.length};
    const rules = [...this.state.rules, newRule];
    this.handleSave(rules, t('Successfully added rule'));
  };

  handleUpdateRule = (updatedRule: Rule) => {
    const rules = this.state.rules.map(rule => {
      if (rule.id === updatedRule.id) {
        return updatedRule;
      }
      return rule;
    });

    this.handleSave(rules, t('Successfully updated rule'));
  };

  handleDeleteRule = (rulesToBeDeleted: Array<Rule['id']>) => {
    const rules = this.state.rules.filter(rule => !rulesToBeDeleted.includes(rule.id));
    this.handleSave(rules, t('Successfully deleted rule'));
  };

  handleToggleAddRuleModal = (showAddRuleModal: boolean) => () => {
    this.setState({showAddRuleModal});
  };

  handleUpdateEventId = (eventId: string) => {
    this.setState({eventId: {value: eventId}});
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
      errors,
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
              errors={errors}
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
            errors={errors}
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
