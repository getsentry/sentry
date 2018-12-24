import PropTypes from 'prop-types';
import React from 'react';
import {t} from 'app/locale';
import styled from 'react-emotion';

import {analytics} from 'app/utils/analytics';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import {PanelItem} from 'app/components/panels';
import {promptsUpdate} from 'app/actionCreators/prompts';
import ProgressBar from './progressBar';

const STEPS = {
  tag: {
    desc: t('Tag an error'),
    url: 'tag-errors',
    msg: 'knowing which errors were introduced in a release, ',
  },
  repo: {
    desc: t('Link to a repo'),
    url: 'link-repository',
    msg: 'determining which commit caused an error, ',
  },
  commit: {
    desc: t('Associate commits'),
    url: 'b-associate-commits-with-a-release',
    msg: 'determining which commit caused an error, ',
  },
  deploy: {
    desc: t('Tell sentry about a deploy'),
    url: 'create-deploy',
    msg: 'receiving notifications when your code gets deployed, ',
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

  buildMessage(remainingSteps) {
    let keys = remainingSteps.map(step => step.step);
    let message = "You're missing out on ";

    if (keys.includes('tag')) {
      message += STEPS.tag.msg;
    }
    if (keys.includes('repo') || keys.includes('commit')) {
      message += STEPS.repo.msg;
    }
    if (keys.includes('deploy')) {
      message += STEPS.deploy.msg;
    }

    message += 'and more!';

    this.setState({message});
  }

  getRemainingSteps(setupStatus) {
    let remainingSteps;
    if (setupStatus) {
      remainingSteps = setupStatus.filter(step => step.complete === false);

      let nextStep = remainingSteps[0] && STEPS[remainingSteps[0].step];

      this.buildMessage(remainingSteps);

      this.setState({
        remainingSteps: Object.keys(remainingSteps).length,
        nextStep,
      });

      this.recordAnalytics('viewed', {
        steps: setupStatus,
        ...(nextStep && {cta: nextStep.desc}),
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
      action,
    });
  }

  recordAnalytics(action, data) {
    let {project, organization} = this.context;

    data.org_id = parseInt(organization.id, 10);
    data.project_id = parseInt(project.id, 10);

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
    let {remainingSteps, showBar, nextStep, message} = this.state;

    if (!remainingSteps || remainingSteps === 0 || !showBar) {
      return null;
    }

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
                >
                  {t(`${nextStep.desc}`)}
                </a>
              </span>
              <h4 className="text-light"> {t("Releases aren't 100% set up")}</h4>
            </StyledDiv>
            <div className="row">
              <ProgressBar width={this.getWidth()} />
              <p>{t(`${message}`)}</p>
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
