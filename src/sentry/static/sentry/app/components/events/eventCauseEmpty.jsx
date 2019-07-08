import moment from 'moment';
import PropTypes from 'prop-types';
import React from 'react';
import * as Sentry from '@sentry/browser';

import Button from 'app/components/button';
import CommitRow from 'app/components/commitRow';
import {Panel} from 'app/components/panels';
import {promptsUpdate} from 'app/actionCreators/prompts';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import {t} from 'app/locale';
import withApi from 'app/utils/withApi';

const SAMPLE_COMMIT = {
  id: 'ff821e0',
  author: {name: 'User Name'},
  dateCreated: moment()
    .subtract(3, 'day')
    .format(),
  repository: {
    provider: {id: 'integrations:github', name: 'GitHub', status: 'active'},
  },
  message: 'ref(oops): This commit accidentally broke something',
};

class EventCauseEmpty extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    organization: SentryTypes.Organization.isRequired,
    project: SentryTypes.Project.isRequired,
  };

  state = {
    shouldShow: undefined,
  };

  componentDidMount() {
    this.fetchData();
  }

  fetchData() {
    const {api, project, organization} = this.props;

    api.request('/promptsactivity/', {
      method: 'GET',
      query: {
        project_id: project.id,
        organization_id: organization.id,
        feature: 'suspect_commits',
      },
      success: (data, _, jqXHR) => {
        this.setState({
          shouldShow: this.shouldShow(data),
        });
      },
      error: err => {
        Sentry.captureException(err);
      },
    });
  }

  shouldShow({data} = {}) {
    if (data && data.dismissed_ts) {
      return false;
    }
    if (data && data.snoozed_ts) {
      const now = Date.now() / 1000;
      const snoozingTime = (now - data.snoozed_ts) / (60 * 24);
      return snoozingTime > 3; // 3 days
    }
    return true;
  }

  handleClick(action) {
    const {api, project, organization} = this.props;

    const data = {
      projectId: project.id,
      organizationId: organization.id,
      feature: 'suspect_commits',
      status: action,
    };
    promptsUpdate(api, data).then(this.setState({shouldShow: false}));
  }

  render() {
    const {shouldShow} = this.state;
    if (!shouldShow) {
      return null;
    }

    return (
      <div className="box">
        <div className="box-header">
          <h3 className="pull-left">
            {t('Suspect Commits')} ({1})
          </h3>
          <div className="btn-group">
            <Button
              priority="primary"
              size="small"
              href="https://docs.sentry.io/workflow/releases/#create-release"
              style={{color: '#fff'}}
            >
              {t('Read the docs')}
            </Button>
            <Button
              size="small"
              onClick={() => this.handleClick('snoozed')}
              style={{marginLeft: space(1)}}
            >
              {t('Remind me later')}
            </Button>
            <Button
              size="small"
              onClick={() => this.handleClick('dismissed')}
              style={{marginLeft: space(1)}}
            >
              {t('Dismiss')}
            </Button>
          </div>
        </div>
        <Panel>
          <CommitRow key={SAMPLE_COMMIT.id} commit={SAMPLE_COMMIT} />
        </Panel>
      </div>
    );
  }
}

export default withApi(EventCauseEmpty);
