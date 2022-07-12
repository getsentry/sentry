import {Component} from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import codesworth from 'sentry-images/spot/codesworth.svg';

import {promptsCheck, promptsUpdate} from 'sentry/actionCreators/prompts';
import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import {CommitRow} from 'sentry/components/commitRow';
import {DataSection} from 'sentry/components/events/styles';
import {Panel} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Commit, Organization, Project, RepositoryStatus} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {IssueEventKey} from 'sentry/utils/analytics/issueAnalyticsEvents';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import getDynamicText from 'sentry/utils/getDynamicText';
import {promptCanShow, promptIsDismissed} from 'sentry/utils/promptIsDismissed';
import withApi from 'sentry/utils/withApi';

const EXAMPLE_COMMITS = ['dec0de', 'de1e7e', '5ca1ed'];

const DUMMY_COMMIT: Commit = {
  id: getDynamicText({
    value: EXAMPLE_COMMITS[Math.floor(Math.random() * EXAMPLE_COMMITS.length)],
    fixed: '5ca1ed',
  }),
  author: {
    id: '',
    name: 'codesworth',
    username: '',
    email: 'codesworth@example.com',
    ip_address: '',
    lastSeen: '',
    lastLogin: '',
    isSuperuser: false,
    isAuthenticated: false,
    emails: [],
    isManaged: false,
    lastActive: '',
    isStaff: false,
    identities: [],
    isActive: true,
    has2fa: false,
    canReset2fa: false,
    authenticators: [],
    dateJoined: '',
    options: {
      theme: 'system',
      timezone: '',
      stacktraceOrder: 1,
      language: '',
      clock24Hours: false,
      avatarType: 'letter_avatar',
    },
    flags: {newsletter_consent_prompt: false},
    hasPasswordAuth: true,
    permissions: new Set([]),
    experiments: {},
  },
  dateCreated: moment().subtract(3, 'day').format(),
  repository: {
    id: '',
    integrationId: '',
    name: '',
    externalSlug: '',
    url: '',
    provider: {
      id: 'integrations:github',
      name: 'GitHub',
    },
    dateCreated: '',
    status: RepositoryStatus.ACTIVE,
  },
  releases: [],
  message: t('This example commit broke something'),
};

const SUSPECT_COMMITS_FEATURE = 'suspect_commits';

type ClickPayload = {
  action: 'snoozed' | 'dismissed';
  eventKey: IssueEventKey;
};

type Props = {
  api: Client;
  event: Event;
  organization: Organization;
  project: Project;
};

type State = {
  shouldShow: boolean | undefined;
};

class EventCauseEmpty extends Component<Props, State> {
  state: State = {
    shouldShow: undefined,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    const {shouldShow} = this.state;

    if (!prevState.shouldShow && shouldShow) {
      this.trackAnalytics('event_cause.viewed');
    }
  }

  async fetchData() {
    const {api, event, project, organization} = this.props;

    if (!promptCanShow(SUSPECT_COMMITS_FEATURE, event.eventID)) {
      this.setState({shouldShow: false});
      return;
    }

    const data = await promptsCheck(api, {
      projectId: project.id,
      organizationId: organization.id,
      feature: SUSPECT_COMMITS_FEATURE,
    });

    this.setState({shouldShow: !promptIsDismissed(data ?? {}, 7)});
  }

  handleClick({action, eventKey}: ClickPayload) {
    const {api, project, organization} = this.props;

    const data = {
      projectId: project.id,
      organizationId: organization.id,
      feature: SUSPECT_COMMITS_FEATURE,
      status: action,
    };
    promptsUpdate(api, data).then(() => this.setState({shouldShow: false}));
    this.trackAnalytics(eventKey);
  }

  trackAnalytics(eventKey: IssueEventKey) {
    const {project, organization} = this.props;

    trackAdvancedAnalyticsEvent(eventKey, {
      project_id: project.id,
      platform: project.platform,
      organization,
    });
  }

  render() {
    if (!this.state.shouldShow) {
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
                size="sm"
                priority="primary"
                href="https://docs.sentry.io/product/releases/setup/"
                onClick={() => this.trackAnalytics('event_cause.docs_clicked')}
              >
                {t('Read the docs')}
              </DocsButton>

              <div>
                <SnoozeButton
                  title={t('Remind me next week')}
                  size="sm"
                  onClick={() =>
                    this.handleClick({
                      action: 'snoozed',
                      eventKey: 'event_cause.snoozed',
                    })
                  }
                >
                  {t('Snooze')}
                </SnoozeButton>
                <DismissButton
                  title={t('Dismiss for this project')}
                  size="sm"
                  onClick={() =>
                    this.handleClick({
                      action: 'dismissed',
                      eventKey: 'event_cause.dismissed',
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
    color: ${p => p.theme.gray300};
  }

  p {
    font-size: 13px;
    font-weight: bold;
    color: ${p => p.theme.textColor};
    margin-bottom: ${space(1.5)};
  }
`;

const ButtonList = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(1)};
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
