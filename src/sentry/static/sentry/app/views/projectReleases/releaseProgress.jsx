import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import ApiMixin from 'app/mixins/apiMixin';
import Button from 'app/components/button';
import {PanelItem} from 'app/components/panels';
import SentryTypes from 'app/sentryTypes';

const STEPS = {
  tag: 'Tag an error',
  repo: 'Link to a repo',
  commit: 'Associate commits',
  deploy: 'Tell sentry about a deploy',
};

const ReleaseProgress = createReactClass({
  displayName: 'releaseProgress',
  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
  },

  contextTypes: {
    organization: SentryTypes.Organization,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      setupStatus: null,
      prompts: null,
    };
  },

  componentDidMount() {
    this.fetchData();
    this.fetchSetupStatus();
  },

  fetchData() {
    this.api.request('/promptsactivity/', {
      method: 'GET',
      data: {
        organization_id: this.context.organization.id,
      },
      success: data => {
        this.setState({
          prompts: data,
          loading: false,
          error: false,
        });
      },
      error: data => {
        this.setState({
          error: true,
        });
      },
    });
  },

  fetchSetupStatus() {
    let url = this.getCompletionStatusEndpoint();

    this.api.request(url, {
      success: data => {
        this.setState({
          setupStatus: data,
        });
      },
      error: error => {
        this.setState({
          error: true,
        });
      },
    });
  },

  getRemainingSteps() {
    let {setupStatus} = this.state;
    let todos;
    if (!setupStatus) return null;

    todos = setupStatus
      .filter(step => step.complete === false)
      .map(displayStep => STEPS[displayStep.step]);
    return todos;
  },

  getCompletionStatusEndpoint() {
    const {orgId, projectId} = this.props;
    return `/projects/${orgId}/${projectId}/releases/completion/`;
  },

  showBar() {
    let {prompts} = this.state;
    if (!prompts) return null;

    let prompt = prompts.find(p => p.feature === 'releases');
    let status = prompt && prompt.status;
    return status !== 'snoozed' && status !== 'dismissed';
  },

  handleClick(action) {
    this.api.request('/promptsactivity/', {
      method: 'PUT',
      data: {
        organization_id: this.context.organization.id,
        project_id: 4,
        feature: 'releases',
        status: action,
      },
      success: data => {
        this.setState({showBar: false});
      },
    });
  },

  renderBody(remainingSteps) {
    return (
      <PanelItem>
        <div> You haven't finished setting up releases!! </div>
        <div>
          {' '}
          Remaining steps:
          <ul>
            {remainingSteps.map((step, i) => {
              return <li key={i}>{step}</li>;
            })}
          </ul>
        </div>
        <div>
          <Button priority="primary" onClick={() => this.handleClick('dismissed')}>
            Dismiss
          </Button>
          <Button priority="primary" onClick={() => this.handleClick('snoozed')}>
            Remind Me Later
          </Button>
        </div>
      </PanelItem>
    );
  },

  render() {
    let remainingSteps = this.getRemainingSteps();
    let showBar = this.showBar();
    return remainingSteps && showBar ? this.renderBody(remainingSteps) : '';
  },
});

export default ReleaseProgress;
