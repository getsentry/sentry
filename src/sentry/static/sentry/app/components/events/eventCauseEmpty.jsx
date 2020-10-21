import moment from 'moment';
import PropTypes from 'prop-types';
import {Component} from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import codesworth from 'app/../images/spot/codesworth.png';
import CommitRow from 'app/components/commitRow';
import getDynamicText from 'app/utils/getDynamicText';
import {DataSection} from 'app/components/events/styles';
import {Panel} from 'app/components/panels';
import {promptsUpdate} from 'app/actionCreators/prompts';
import SentryTypes from 'app/sentryTypes';
import {snoozedDays} from 'app/utils/promptsActivity';
import space from 'app/styles/space';
import {t} from 'app/locale';
import {trackAdhocEvent, trackAnalyticsEvent} from 'app/utils/analytics';
import withApi from 'app/utils/withApi';

const EXAMPLE_COMMITS = ['dec0de', 'de1e7e', '5ca1ed'];

const DUMMY_COMMIT = {
  id: getDynamicText({
    value: EXAMPLE_COMMITS[Math.floor(Math.random() * EXAMPLE_COMMITS.length)],
    fixed: '5ca1ed',
  }),
  author: {name: 'codesworth'},
  dateCreated: moment().subtract(3, 'day').format(),
  repository: {
    provider: {id: 'integrations:github', name: 'GitHub', status: 'active'},
  },
  message: t('This example commit broke something'),
};

class EventCauseEmpty extends Component {
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

  componentDidUpdate(_prevProps, prevState) {
    const {project, organization} = this.props;
    const {shouldShow} = this.state;

    if (!prevState.shouldShow && shouldShow) {
      // send to reload only due to high event volume
      trackAdhocEvent({
        eventKey: 'event_cause.viewed',
        org_id: parseInt(organization.id, 10),
        project_id: parseInt(project.id, 10),
        platform: project.platform,
      });
    }
  }

  async fetchData() {
    const {api, project, organization} = this.props;

    const data = await api.requestPromise('/promptsactivity/', {
      query: {
        project_id: project.id,
        organization_id: organization.id,
        feature: 'suspect_commits',
      },
    });

    this.setState({shouldShow: this.shouldShow(data)});
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

  handleClick({action, eventKey, eventName}) {
    const {api, project, organization} = this.props;

    const data = {
      projectId: project.id,
      organizationId: organization.id,
      feature: 'suspect_commits',
      status: action,
    };
    promptsUpdate(api, data).then(this.setState({shouldShow: false}));
    this.trackAnalytics({eventKey, eventName});
  }

  trackAnalytics({eventKey, eventName}) {
    const {project, organization} = this.props;

    trackAnalyticsEvent({
      eventKey,
      eventName,
      organization_id: parseInt(organization.id, 10),
      project_id: parseInt(project.id, 10),
      platform: project.platform,
    });
  }

  render() {
    const {shouldShow} = this.state;
    if (!shouldShow) {
      return null;
    }

    return (
      <DataSection data-test-id="loaded-event-cause-empty">
        <StyledPanel dashedBorder>
          <BoxHeader>
            <Description>
              <h3>{t('Configure Suspect Commits')}</h3>
              <p>{t('To identify which commit caused this issue')}</p>
            </Description>
            <ButtonList>
              <DocsButton
                size="small"
                priority="primary"
                href="https://docs.sentry.io/workflow/releases/#create-release"
                onClick={() =>
                  this.trackAnalytics({
                    eventKey: 'event_cause.docs_clicked',
                    eventName: 'Event Cause Docs Clicked',
                  })
                }
              >
                {t('Read the docs')}
              </DocsButton>

              <div>
                <SnoozeButton
                  title={t('Remind me next week')}
                  size="small"
                  onClick={() =>
                    this.handleClick({
                      action: 'snoozed',
                      eventKey: 'event_cause.snoozed',
                      eventName: 'Event Cause Snoozed',
                    })
                  }
                >
                  {t('Snooze')}
                </SnoozeButton>
                <DismissButton
                  title={t('Dismiss for this project')}
                  size="small"
                  onClick={() =>
                    this.handleClick({
                      action: 'dismissed',
                      eventKey: 'event_cause.dismissed',
                      eventName: 'Event Cause Dismissed',
                    })
                  }
                >
                  {t('Dismiss')}
                </DismissButton>
              </div>
            </ButtonList>
          </BoxHeader>
          <ExampleCommitPanel>
            <CommitRow
              key={DUMMY_COMMIT.id}
              commit={DUMMY_COMMIT}
              customAvatar={<CustomAvatar src={codesworth} />}
            />
          </ExampleCommitPanel>
        </StyledPanel>
      </DataSection>
    );
  }
}

const StyledPanel = styled(Panel)`
  padding: ${space(3)};
  padding-bottom: 0;
  background: none;
`;

const Description = styled('div')`
  h3 {
    font-size: 14px;
    text-transform: uppercase;
    margin-bottom: ${space(0.25)};
    color: ${p => p.theme.gray500};
  }

  p {
    font-size: 13px;
    font-weight: bold;
    color: ${p => p.theme.gray700};
    margin-bottom: ${space(1.5)};
  }
`;

const ButtonList = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
  align-items: center;
  justify-self: end;
  margin-bottom: 16px;
`;

const DocsButton = styled(Button)`
  &:focus {
    color: ${p => p.theme.white};
  }
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

const ExampleCommitPanel = styled(Panel)`
  overflow: hidden;
  pointer-events: none;
  position: relative;
  padding-right: ${space(3)};

  &:after {
    display: block;
    content: 'Example';
    position: absolute;
    top: 16px;
    right: -24px;
    text-transform: uppercase;
    background: #e46187;
    padding: 4px 26px;
    line-height: 11px;
    font-size: 11px;
    color: ${p => p.theme.white};
    transform: rotate(45deg);
  }
`;

const CustomAvatar = styled('img')`
  height: 48px;
  padding-right: 12px;
  margin: -6px 0px -6px -2px;
`;

const BoxHeader = styled('div')`
  display: grid;
  align-items: start;
  grid-template-columns: repeat(auto-fit, minmax(256px, 1fr));
`;

export default withApi(EventCauseEmpty);
