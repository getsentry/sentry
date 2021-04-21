import React from 'react';
import styled from '@emotion/styled';

import quickTraceExample from 'sentry-images/spot/performance-quick-trace.svg';

import {promptsCheck, promptsUpdate} from 'app/actionCreators/prompts';
import {Client} from 'app/api';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Group, Organization, PromptActivity} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {getDocsPlatform} from 'app/utils/docs';
import {snoozedDays} from 'app/utils/promptsActivity';
import withApi from 'app/utils/withApi';

type Props = {
  api: Client;
  group: Group;
  organization: Organization;
};

type State = {
  shouldShow: boolean | undefined;
};

class EventQuickTrace extends React.Component<Props, State> {
  state: State = {
    shouldShow: undefined,
  };

  componentDidMount() {
    this.fetchData();
  }

  async fetchData() {
    const {api, group, organization} = this.props;
    const {project} = group;

    const data = await promptsCheck(api, {
      projectId: project.id,
      organizationId: organization.id,
      feature: 'distributed_tracing',
    });

    this.setState({shouldShow: this.shouldShow(data ?? {})});
  }

  shouldShow({snoozedTime, dismissedTime}: PromptActivity) {
    if (dismissedTime) {
      return false;
    }
    if (snoozedTime) {
      return snoozedDays(snoozedTime) > 7;
    }
    return true;
  }

  trackAnalytics({eventKey, eventName}) {
    const {group, organization} = this.props;
    const {project} = group;

    trackAnalyticsEvent({
      eventKey,
      eventName,
      organization_id: parseInt(organization.id, 10),
      project_id: parseInt(project.id, 10),
      platform: project.platform,
    });
  }

  handleClick({action, eventKey, eventName}) {
    const {api, group, organization} = this.props;
    const {project} = group;
    const data = {
      projectId: project.id,
      organizationId: organization.id,
      feature: 'distributed_tracing',
      status: action,
    };
    promptsUpdate(api, data).then(() => this.setState({shouldShow: false}));
    this.trackAnalytics({eventKey, eventName});
  }

  createDocsLink() {
    const platform = this.props.group.project.platform ?? null;
    const docsPlatform = platform ? getDocsPlatform(platform, true) : null;
    return docsPlatform === null
      ? 'https://docs.sentry.io/product/performance/getting-started/'
      : `https://docs.sentry.io/platforms/${docsPlatform}/performance/`;
  }

  render() {
    const {shouldShow} = this.state;
    if (!shouldShow) {
      return null;
    }

    return (
      <StyledPanel dashedBorder>
        <div>
          <Header>{t('Configure Distributed Tracing')}</Header>
          <Description>
            {t('See what happened right before and after this error')}
          </Description>
        </div>
        <Image src={quickTraceExample} alt="configure distributed tracing" />
        <ActionButtons>
          <Button
            size="small"
            priority="primary"
            href={this.createDocsLink()}
            onClick={() =>
              this.trackAnalytics({
                eventKey: 'quick_trace.missing_instrumentation.docs',
                eventName: 'Quick Trace: Missing Instrumentation Docs',
              })
            }
          >
            {t('Read the docs')}
          </Button>
          <ButtonBar merged>
            <Button
              title={t('Remind me next week')}
              size="small"
              onClick={() =>
                this.handleClick({
                  action: 'snoozed',
                  eventKey: 'quick_trace.missing_instrumentation.snoozed',
                  eventName: 'Quick Trace: Missing Instrumentation Snoozed',
                })
              }
            >
              {t('Snooze')}
            </Button>
            <Button
              title={t('Dismiss for this project')}
              size="small"
              onClick={() =>
                this.handleClick({
                  action: 'dismissed',
                  eventKey: 'quick_trace.missing_instrumentation.dismissed',
                  eventName: 'Quick Trace: Missing Instrumentation Dismissed',
                })
              }
            >
              {t('Dismiss')}
            </Button>
          </ButtonBar>
        </ActionButtons>
      </StyledPanel>
    );
  }
}

const StyledPanel = styled(Panel)`
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  grid-template-rows: auto max-content;
  grid-gap: ${space(1)};
  background: none;
  padding: ${space(2)};
  margin: ${space(2)} 0;
`;

const Header = styled('h3')`
  font-size: ${p => p.theme.fontSizeSmall};
  text-transform: uppercase;
  color: ${p => p.theme.gray300};
  margin-bottom: ${space(1)};
`;

const Description = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Image = styled('img')`
  grid-row: 1/3;
  grid-column: 2/3;
  justify-self: end;
`;

const ActionButtons = styled('div')`
  display: grid;
  grid-template-columns: max-content auto;
  justify-items: start;
  align-items: end;
  grid-column-gap: ${space(1)};
`;

export default withApi(EventQuickTrace);
