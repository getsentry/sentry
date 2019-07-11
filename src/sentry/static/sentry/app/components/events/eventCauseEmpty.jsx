import moment from 'moment';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import * as Sentry from '@sentry/browser';

import Button from 'app/components/button';
import CommitRow from 'app/components/commitRow';
import {Panel} from 'app/components/panels';
import {promptsUpdate} from 'app/actionCreators/prompts';
import robotLogo from 'app/../images/robot-logo.png';
import SentryTypes from 'app/sentryTypes';
import {snoozedDays} from 'app/utils/promptsActivity';
import space from 'app/styles/space';
import {t} from 'app/locale';
import withApi from 'app/utils/withApi';

const DUMMY_COMMIT = {
  id: 'ff721e0',
  author: {name: 'Uh/Oh'},
  dateCreated: moment()
    .subtract(3, 'day')
    .format(),
  repository: {
    provider: {id: 'integrations:github', name: 'GitHub', status: 'active'},
  },
  message: 'This commit accidentally broke something',
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
      success: data => {
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
      return snoozedDays(data.snoozed_ts) > 7;
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
        <StyledPanel dashedBorder>
          <BoxHeader>
            <Description>
              <h3>{t('Suspect Commits')}</h3>
              <p>{t('Sentry can identify which commit caused this issue')}</p>
            </Description>
            <ButtonList>
              <Button
                size="small"
                priority="primary"
                href="https://docs.sentry.io/workflow/releases/#create-release"
              >
                {t('Read the docs')}
              </Button>

              <div>
                <SnoozeButton
                  size="small"
                  onClick={() => this.handleClick('snoozed')}
                  data-test-id="snoozed"
                >
                  {t('Remind me later')}
                </SnoozeButton>
                <DismissButton
                  size="small"
                  onClick={() => this.handleClick('dismissed')}
                  data-test-id="dismissed"
                >
                  {t('Dismiss')}
                </DismissButton>
              </div>
            </ButtonList>
          </BoxHeader>
          <Panel>
            <CommitRow
              key={DUMMY_COMMIT.id}
              commit={DUMMY_COMMIT}
              customAvatar={robotLogo}
            />
          </Panel>
        </StyledPanel>
      </div>
    );
  }
}

const StyledPanel = styled(Panel)`
  padding: ${space(3)};
  padding-bottom: 0;
  background: none;
`;

const BoxHeader = styled('div')`
  display: grid;
  align-items: start;
  grid-template-columns: 1fr max-content;
`;

const Description = styled('div')`
  h3 {
    font-size: 14px;
    text-transform: uppercase;
    margin-bottom: ${space(0.25)};
    color: ${p => p.theme.gray2};
  }

  p {
    font-size: 14px;
    font-weight: bold;
    color: ${p => p.theme.gray4};
    margin-bottom: ${space(1.5)};
  }
`;

const ButtonList = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
  align-items: center;
  float: right;
`;

const SnoozeButton = styled(Button)`
  border-right: 0;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
`;

const DismissButton = styled(Button)`
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
`;

export default withApi(EventCauseEmpty);
