import * as React from 'react';
import styled from '@emotion/styled';

import {promptsCheck, promptsUpdate} from 'app/actionCreators/prompts';
import SidebarPanelActions from 'app/actions/sidebarPanelActions';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {IconUpgrade} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {
  GlobalSelection,
  Organization,
  ProjectSdkUpdates,
  SDKUpdatesSuggestion,
} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {promptIsDismissed} from 'app/utils/promptIsDismissed';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import withSdkUpdates from 'app/utils/withSdkUpdates';

import {SidebarPanelKey} from './sidebar/types';
import Button from './button';

type Props = React.ComponentProps<typeof Alert> & {
  api: Client;
  organization: Organization;
  sdkUpdates?: ProjectSdkUpdates[] | null;
  selection?: GlobalSelection;
  Wrapper?: React.ComponentType;
};

type State = {
  isDismissed: boolean | null;
};

type AnalyticsOpts = {
  organization: Organization;
};

const recordAnalyticsSeen = ({organization}: AnalyticsOpts) =>
  trackAnalyticsEvent({
    eventKey: 'sdk_updates.seen',
    eventName: 'SDK Updates: Seen',
    organization_id: organization.id,
  });

const recordAnalyticsSnoozed = ({organization}: AnalyticsOpts) =>
  trackAnalyticsEvent({
    eventKey: 'sdk_updates.snoozed',
    eventName: 'SDK Updates: Snoozed',
    organization_id: organization.id,
  });

const recordAnalyticsClicked = ({organization}: AnalyticsOpts) =>
  trackAnalyticsEvent({
    eventKey: 'sdk_updates.clicked',
    eventName: 'SDK Updates: Clicked',
    organization_id: organization.id,
  });

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
  grid-gap: ${space(1)};
`;

const GlobalSdkSuggestions = withOrganization(
  withSdkUpdates(withGlobalSelection(withApi(InnerGlobalSdkSuggestions)))
);

export default GlobalSdkSuggestions;
