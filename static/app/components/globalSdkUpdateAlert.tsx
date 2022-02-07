import * as React from 'react';
import styled from '@emotion/styled';

import {promptsCheck, promptsUpdate} from 'sentry/actionCreators/prompts';
import SidebarPanelActions from 'sentry/actions/sidebarPanelActions';
import {Client} from 'sentry/api';
import Alert from 'sentry/components/alert';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {IconUpgrade} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  Organization,
  PageFilters,
  ProjectSdkUpdates,
  SDKUpdatesSuggestion,
} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {promptIsDismissed} from 'sentry/utils/promptIsDismissed';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import withSdkUpdates from 'sentry/utils/withSdkUpdates';

import {SidebarPanelKey} from './sidebar/types';
import Button from './button';

type Props = React.ComponentProps<typeof Alert> & {
  api: Client;
  organization: Organization;
  Wrapper?: React.ComponentType;
  sdkUpdates?: ProjectSdkUpdates[] | null;
  selection?: PageFilters;
};

type State = {
  isDismissed: boolean | null;
};

type AnalyticsOpts = {
  organization: Organization;
};

const recordAnalyticsSeen = ({organization}: AnalyticsOpts) =>
  trackAdvancedAnalyticsEvent('sdk_updates.seen', {organization});

const recordAnalyticsSnoozed = ({organization}: AnalyticsOpts) =>
  trackAdvancedAnalyticsEvent('sdk_updates.snoozed', {organization});

const recordAnalyticsClicked = ({organization}: AnalyticsOpts) =>
  trackAdvancedAnalyticsEvent('sdk_updates.clicked', {organization});

const flattenSuggestions = (list: ProjectSdkUpdates[]) =>
  list.reduce<SDKUpdatesSuggestion[]>(
    (suggestions, sdk) => [...suggestions, ...sdk.suggestions],
    []
  );

class InnerGlobalSdkSuggestions extends React.Component<Props, State> {
  state: State = {
    isDismissed: null,
  };

  componentDidMount() {
    this.promptsCheck();
    recordAnalyticsSeen({organization: this.props.organization});
  }

  async promptsCheck() {
    const {api, organization} = this.props;

    const prompt = await promptsCheck(api, {
      organizationId: organization.id,
      feature: 'sdk_updates',
    });

    this.setState({
      isDismissed: promptIsDismissed(prompt),
    });
  }

  snoozePrompt = () => {
    const {api, organization} = this.props;
    promptsUpdate(api, {
      organizationId: organization.id,
      feature: 'sdk_updates',
      status: 'snoozed',
    });

    this.setState({isDismissed: true});
    recordAnalyticsSnoozed({organization: this.props.organization});
  };

  render() {
    const {
      api: _api,
      selection,
      sdkUpdates,
      organization,
      Wrapper,
      ...props
    } = this.props;

    const {isDismissed} = this.state;

    if (!sdkUpdates || isDismissed === null || isDismissed) {
      return null;
    }

    // withSdkUpdates explicitly only queries My Projects. This means that when
    // looking at any projects outside of My Projects (like All Projects), this
    // will only show the updates relevant to the to user.
    const projectSpecificUpdates =
      selection?.projects.length === 0 || selection?.projects === [ALL_ACCESS_PROJECTS]
        ? sdkUpdates
        : sdkUpdates.filter(update =>
            selection?.projects?.includes(parseInt(update.projectId, 10))
          );

    // Are there any updates?
    if (flattenSuggestions(projectSpecificUpdates).length === 0) {
      return null;
    }

    const showBroadcastsPanel = (
      <Button
        priority="link"
        size="zero"
        onClick={() => {
          SidebarPanelActions.activatePanel(SidebarPanelKey.Broadcasts);
          recordAnalyticsClicked({organization});
        }}
      >
        {t('Review updates')}
      </Button>
    );

    const notice = (
      <Alert type="info" icon={<IconUpgrade />} {...props}>
        <Content>
          {t(
            `You have outdated SDKs in your projects. Update them for important fixes and features.`
          )}
          <Actions>
            <Button
              priority="link"
              size="zero"
              title={t('Dismiss for the next two weeks')}
              onClick={this.snoozePrompt}
            >
              {t('Remind me later')}
            </Button>
            |{showBroadcastsPanel}
          </Actions>
        </Content>
      </Alert>
    );

    return Wrapper ? <Wrapper>{notice}</Wrapper> : notice;
  }
}

const Content = styled('div')`
  display: flex;
  flex-wrap: wrap;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    justify-content: space-between;
  }
`;

const Actions = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, max-content);
  gap: ${space(1)};
`;

const GlobalSdkSuggestions = withOrganization(
  withSdkUpdates(withPageFilters(withApi(InnerGlobalSdkSuggestions)))
);

export default GlobalSdkSuggestions;
