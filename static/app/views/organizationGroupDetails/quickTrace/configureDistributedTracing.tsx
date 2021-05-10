import {Component} from 'react';
import styled from '@emotion/styled';

import quickTraceExample from 'sentry-images/spot/performance-quick-trace.svg';

import {promptsCheck, promptsUpdate} from 'app/actionCreators/prompts';
import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Hovercard from 'app/components/hovercard';
import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {Event} from 'app/types/event';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {getConfigureTracingDocsLink} from 'app/utils/docs';
import {promptCanShow, promptIsDismissed} from 'app/utils/promptIsDismissed';
import withApi from 'app/utils/withApi';

const DISTRIBUTED_TRACING_FEATURE = 'distributed_tracing';

type Props = {
  api: Client;
  project: Project;
  organization: Organization;
  event: Event;
};

type State = {
  shouldShow: boolean | null;
};

class ConfigureDistributedTracing extends Component<Props, State> {
  state: State = {
    shouldShow: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  async fetchData() {
    const {api, event, project, organization} = this.props;

    if (!promptCanShow(DISTRIBUTED_TRACING_FEATURE, event.eventID)) {
      this.setState({shouldShow: false});
      return;
    }

    const data = await promptsCheck(api, {
      projectId: project.id,
      organizationId: organization.id,
      feature: DISTRIBUTED_TRACING_FEATURE,
    });

    this.setState({shouldShow: !promptIsDismissed(data ?? {}, 30)});
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

  handleClick({action, eventKey, eventName}) {
    const {api, project, organization} = this.props;
    const data = {
      projectId: project.id,
      organizationId: organization.id,
      feature: DISTRIBUTED_TRACING_FEATURE,
      status: action,
    };
    promptsUpdate(api, data).then(() => this.setState({shouldShow: false}));
    this.trackAnalytics({eventKey, eventName});
  }

  renderActionButton(docsLink: string) {
    const features = ['organizations:performance-view'];
    const noFeatureMessage = t('Requires performance monitoring.');

    const renderDisabled = p => (
      <Hovercard
        body={
          <FeatureDisabled
            features={features}
            hideHelpToggle
            message={noFeatureMessage}
            featureName={noFeatureMessage}
          />
        }
      >
        {p.children(p)}
      </Hovercard>
    );

    return (
      <Feature
        hookName="feature-disabled:configure-distributed-tracing"
        features={features}
        renderDisabled={renderDisabled}
      >
        {() => (
          <Button
            size="small"
            priority="primary"
            href={docsLink}
            onClick={() =>
              this.trackAnalytics({
                eventKey: 'quick_trace.missing_instrumentation.docs',
                eventName: 'Quick Trace: Missing Instrumentation Docs',
              })
            }
          >
            {t('Read the docs')}
          </Button>
        )}
      </Feature>
    );
  }

  render() {
    const {project} = this.props;
    const {shouldShow} = this.state;
    if (!shouldShow) {
      return null;
    }

    const docsLink = getConfigureTracingDocsLink(project);
    // if the platform does not support performance, do not show this prompt
    if (docsLink === null) {
      return null;
    }

    return (
      <ExampleQuickTracePanel dashedBorder>
        <div>
          <Header>{t('Configure Distributed Tracing')}</Header>
          <Description>
            {t('See what happened right before and after this error')}
          </Description>
        </div>
        <Image src={quickTraceExample} alt="configure distributed tracing" />
        <ActionButtons>
          {this.renderActionButton(docsLink)}
          <ButtonBar merged>
            <Button
              title={t('Remind me next month')}
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
      </ExampleQuickTracePanel>
    );
  }
}

const ExampleQuickTracePanel = styled(Panel)`
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

export default withApi(ConfigureDistributedTracing);
