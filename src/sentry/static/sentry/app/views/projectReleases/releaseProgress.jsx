import PropTypes from 'prop-types';
import React from 'react';
import {t} from 'app/locale';
import styled from 'react-emotion';

import {analytics} from 'app/utils/analytics';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import {PanelItem} from 'app/components/panels';
import {promptsUpdate} from 'app/actionCreators/prompts';
import ProgressBar from 'app/views/projectReleases/progressBar';

const STEPS = {
  tag: {
    desc: t('Tag an error'),
    url: 'tag-errors',
  },
  repo: {
    desc: t('Link to a repo'),
    url: 'link-repository',
  },
  commit: {
    desc: t('Associate commits'),
    url: 'b-associate-commits-with-a-release',
  },
  deploy: {
    desc: t('Tell sentry about a deploy'),
    url: 'create-deploy',
  },
};

class ReleaseProgress extends AsyncComponent {
  static contextTypes = {
    organization: PropTypes.object,
    project: PropTypes.object,
    router: PropTypes.object,
  };

  getEndpoints() {
    let {project, organization} = this.context;
    let data = {
      organization_id: organization.id,
      project_id: project.id,
      feature: 'releases',
    };
    return [
      ['promptsActivity', '/promptsactivity/', {data}],
      [
        'setupStatus',
        `/projects/${organization.slug}/${project.slug}/releases/completion/`,
      ],
    ];
  }
  onRequestSuccess({stateKey, data, jqXHR}) {
    if (stateKey === 'promptsActivity') {
      this.showBar(data);
    } else if (stateKey === 'setupStatus') {
      this.getRemainingSteps(data);
    }
  }

  getRemainingSteps(setupStatus) {
    let {organization, project} = this.context;
    let remainingSteps;
    if (setupStatus) {
      remainingSteps = setupStatus.filter(step => step.complete === false);

      this.setState({
        remainingSteps: Object.keys(remainingSteps).length,
        nextStep: remainingSteps[0] && STEPS[remainingSteps[0].step],
      });

      this.recordAnalytics('viewed', {
        org_id: parseInt(organization.id, 10),
        project_id: parseInt(project.id, 10),
        steps: setupStatus,
      });
    }
  }

  showBar({data} = {}) {
    let show;
    if (data && data.snoozed_ts) {
      // check if more than 3 days have passed since snooze
      let now = Date.now() / 1000;
      let snoozingTime = (now - data.snoozed_ts) / (60 * 24);
      show = snoozingTime > 3 ? true : false;
    } else if (data && data.dismissed_ts) {
      show = false;
    } else {
      show = true;
    }

    this.setState({showBar: show});
  }

  handleClick(action) {
    let {project, organization} = this.context;

    let params = {
      projectId: project.id,
      organizationId: organization.id,
      feature: 'releases',
      status: action,
    };
    promptsUpdate(this.api, params).then(this.setState({showBar: false}));
    this.recordAnalytics('closed', {
      org_id: parseInt(organization.id, 10),
      project_id: parseInt(project.id, 10),
      action,
    });
  }

  recordAnalytics(action, data) {
    if (action === 'next') {
      analytics('releases.progress_bar_clicked_next', data);
    } else if (action === 'closed') {
      analytics('releases.progress_bar_closed', data);
    } else if (action === 'viewed') {
      analytics('releases.progress_bar_viewed', data);
    }
  }

  getWidth() {
    let {remainingSteps} = this.state;
    let width =
      100 * (Object.keys(STEPS).length - remainingSteps) / Object.keys(STEPS).length;

    return width === 0 ? 25 : width;
  }

  renderBody() {
    let {remainingSteps, showBar} = this.state;

    if (!remainingSteps || remainingSteps === 0 || !showBar) {
      return null;
    }

    let {nextStep} = this.state;

    return (
      <PanelItem>
        <div className="col-sm-8">
          <div>
            <StyledDiv className="row">
              <span className="pull-right">
                {t('Next step: ')}
                <a
                  href={`https://docs.sentry.io/learn/releases/#${nextStep.url}`}
                  onClick={() => this.recordAnalytics('next', {cta: nextStep.desc})}
                >{`${nextStep.desc}`}</a>
              </span>
              <h4 className="text-light"> {t("Releases aren't 100% set up")}</h4>
            </StyledDiv>
            <div className="row">
              <ProgressBar width={this.getWidth()} />
              <p>
                {t(
                  'Save time by surfacing when issues are first introduced, what commits are responsible, and more!'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="col-sm-4">
          <div className="pull-right">
            <StyledButton
              className="text-light"
              onClick={() => this.handleClick('dismissed')}
              size="large"
              data-test-id="dismissed"
            >
              {t('Dismiss')}
            </StyledButton>
            <StyledButton
              className="text-light"
              onClick={() => this.handleClick('snoozed')}
              size="large"
              data-test-id="snoozed"
            >
              {t('Remind Me Later')}
            </StyledButton>
          </div>
        </div>
      </PanelItem>
    );
  }
}

const StyledButton = styled(Button)`
  margin: 5px;
`;

const StyledDiv = styled('div')`
  margin-bottom: 10px;
`;

export default ReleaseProgress;
