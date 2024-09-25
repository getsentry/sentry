import {Component, Fragment, useEffect} from 'react';

import {getAllBroadcasts, markBroadcastsAsSeen} from 'sentry/actionCreators/broadcasts';
import type {Client} from 'sentry/api';
import DemoModeGate from 'sentry/components/acl/demoModeGate';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {BroadcastPanelItem} from 'sentry/components/sidebar/broadcastPanelItem';
import SidebarItem from 'sentry/components/sidebar/sidebarItem';
import SidebarPanel from 'sentry/components/sidebar/sidebarPanel';
import SidebarPanelEmpty from 'sentry/components/sidebar/sidebarPanelEmpty';
import {IconBroadcast} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Broadcast} from 'sentry/types/system';
import withApi from 'sentry/utils/withApi';

import type {CommonSidebarProps} from './types';
import {SidebarPanelKey} from './types';

const MARK_SEEN_DELAY = 1000;
const POLLER_DELAY = 600000; // 10 minute poll (60 * 10 * 1000)

type Props = CommonSidebarProps & {
  api: Client;
  organization: Organization;
};

type State = {
  broadcasts: Broadcast[];
  loading: boolean;
};

function BroadcastSidebarContent({
  orientation,
  collapsed,
  loading,
  broadcasts,
  hidePanel,
  onResetCounter,
}: {
  broadcasts: Broadcast[];
  loading: boolean;
  onResetCounter: () => void;
} & Pick<CommonSidebarProps, 'orientation' | 'collapsed' | 'hidePanel'>) {
  useEffect(() => {
    return () => {
      onResetCounter();
    };
  }, [onResetCounter]);

  return (
    <SidebarPanel
      data-test-id="sidebar-broadcasts-panel"
      orientation={orientation}
      collapsed={collapsed}
      title={t("What's new in Sentry")}
      hidePanel={hidePanel}
    >
      {loading ? (
        <LoadingIndicator />
      ) : broadcasts.length === 0 ? (
        <SidebarPanelEmpty>
          {t('No recent updates from the Sentry team.')}
        </SidebarPanelEmpty>
      ) : (
        broadcasts.map(item => (
          <BroadcastPanelItem
            key={item.id}
            hasSeen={item.hasSeen}
            title={item.title}
            message={item.message}
            link={item.link}
            mediaUrl={item.mediaUrl}
            category={item.category}
          />
        ))
      )}
    </SidebarPanel>
  );
}

class Broadcasts extends Component<Props, State> {
  state: State = {
    broadcasts: [],
    loading: true,
  };

  componentDidMount() {
    this.fetchData();
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  componentWillUnmount() {
    window.clearTimeout(this.markSeenTimeout);
    window.clearTimeout(this.pollingTimeout);

    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  pollingTimeout: number | undefined = undefined;
  markSeenTimeout: number | undefined = undefined;

  startPolling() {
    if (this.pollingTimeout) {
      this.stopPolling();
    }
    this.pollingTimeout = window.setTimeout(this.fetchData, POLLER_DELAY);
  }

  stopPolling() {
    window.clearTimeout(this.pollingTimeout);
    this.pollingTimeout = undefined;
  }

  fetchData = async () => {
    if (this.pollingTimeout) {
      this.stopPolling();
    }

    try {
      const data = await getAllBroadcasts(this.props.api, this.props.organization.slug);
      this.setState({loading: false, broadcasts: data || []});
    } catch {
      this.setState({loading: false});
    }

    this.startPolling();
  };

  /**
   * If tab/window loses visibility (note: this is different than focus), stop
   * polling for broadcasts data, otherwise, if it gains visibility, start
   * polling again.
   */
  handleVisibilityChange = () =>
    document.hidden ? this.stopPolling() : this.startPolling();

  handleShowPanel = () => {
    window.clearTimeout(this.markSeenTimeout);

    this.markSeenTimeout = window.setTimeout(this.markSeen, MARK_SEEN_DELAY);
    this.props.onShowPanel();
  };

  markSeen = async () => {
    const unseenBroadcastIds = this.unseenIds;
    if (unseenBroadcastIds.length === 0) {
      return;
    }

    await markBroadcastsAsSeen(this.props.api, unseenBroadcastIds);
  };

  get unseenIds() {
    return this.state.broadcasts
      ? this.state.broadcasts.filter(item => !item.hasSeen).map(item => item.id)
      : [];
  }

  handleResetCounter = () => {
    this.setState(state => ({
      broadcasts: state.broadcasts.map(item => ({...item, hasSeen: true})),
    }));
  };

  render() {
    const {orientation, collapsed, currentPanel, hidePanel} = this.props;
    const {broadcasts, loading} = this.state;

    const unseenPosts = this.unseenIds;

    return (
      <DemoModeGate>
        <Fragment>
          <SidebarItem
            data-test-id="sidebar-broadcasts"
            orientation={orientation}
            collapsed={collapsed}
            active={currentPanel === SidebarPanelKey.BROADCASTS}
            badge={unseenPosts.length}
            icon={<IconBroadcast size="md" />}
            label={t("What's new")}
            onClick={this.handleShowPanel}
            id="broadcasts"
          />

          {currentPanel === SidebarPanelKey.BROADCASTS && (
            <BroadcastSidebarContent
              loading={loading}
              hidePanel={hidePanel}
              broadcasts={broadcasts}
              collapsed={collapsed}
              orientation={orientation}
              onResetCounter={this.handleResetCounter}
            />
          )}
        </Fragment>
      </DemoModeGate>
    );
  }
}

export default withApi(Broadcasts);
