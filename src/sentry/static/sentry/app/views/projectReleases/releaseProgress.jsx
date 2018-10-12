import PropTypes from 'prop-types';
import React from 'react';
import {t} from 'app/locale';

import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import {PanelItem} from 'app/components/panels';

const STEPS = {
  tag: 'Tag an error',
  repo: 'Link to a repo',
  commit: 'Associate commits',
  deploy: 'Tell sentry about a deploy',
};

class ReleaseProgress extends AsyncView {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
  };
  constructor(...args) {
    super(...args);
  }

  getTitle() {
    return t('ReleaseProgress');
  }

  getEndpoints() {
    let data = {
      organization_id: 1,
    };
    const {orgId, projectId} = this.props;

    return [
      ['promptsActivity', '/promptsactivity/', {data}],
      ['setupStatus', `/projects/${orgId}/${projectId}/releases/completion/`],
    ];
  }
  onRequestSuccess({stateKey, data, jqXHR}) {
    if (stateKey === 'promptsActivity') {
      this.showBar(data);
    } else if (stateKey === 'setupStatus') {
      this.getRemainingSteps();
    }
  }

  getRemainingSteps() {
    let {setupStatus} = this.state;
    let remainingSteps;
    if (setupStatus) {
      remainingSteps = setupStatus
        .filter(step => step.complete === false)
        .map(displayStep => STEPS[displayStep.step]);

      this.setState({
        remainingSteps,
      });
    }
  }

  showBar(data) {
    let prompt = data.find(p => p.feature === 'releases');
    let status = prompt && prompt.status !== 'snoozed' && prompt.status !== 'dismissed';
    this.setState({showBar: status});
  }

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
  }

  renderBody() {
    return this.state.remainingSteps && this.state.showBar ? (
      <PanelItem>
        <div> You haven't finished setting up releases!! </div>
        <div>
          {' '}
          Remaining steps:
          <ul>
            {this.state.remainingSteps.map((step, i) => {
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
    ) : (
      ''
    );
  }
}

export default ReleaseProgress;
