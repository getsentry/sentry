import React from 'react';

import {getAllBroadcasts, markBroadcastsAsSeen} from 'app/actionCreators/broadcasts';
import {t} from 'app/locale';
import LoadingIndicator from 'app/components/loadingIndicator';
import SidebarItem from 'app/components/sidebar/sidebarItem';
import SidebarPanel from 'app/components/sidebar/sidebarPanel';
import SidebarPanelEmpty from 'app/components/sidebar/sidebarPanelEmpty';
import SidebarPanelItem from 'app/components/sidebar/sidebarPanelItem';
import {IconBroadcast} from 'app/icons';
import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import {Organization, Broadcast} from 'app/types';

import {CommonSidebarProps} from './types';

const MARK_SEEN_DELAY = 1000;
const POLLER_DELAY = 600000; // 10 minute poll (60 * 10 * 1000)

type Props = CommonSidebarProps & {
  api: Client;
  organization: Organization;
};

type State = {
  broadcasts: Broadcast[];
  loading: boolean;
  error: boolean;
};

class Broadcasts extends React.Component<Props, State> {
  state: State = {
    broadcasts: [],
    loading: true,
    error: false,
  };

  componentDidMount() {
    this.fetchData();

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  componentWillUnmount() {
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.poller) {
      this.stopPoll();
    }
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  poller: number | null = null;
  timer: number | null = null;

  startPoll() {
    this.poller = window.setTimeout(this.fetchData, POLLER_DELAY);
  }

  stopPoll() {
    if (this.poller) {
      window.clearTimeout(this.poller);
      this.poller = null;
    }
  }

  fetchData = async () => {
    if (this.poller) {
      this.stopPoll();
    }

    try {
      const data = await getAllBroadcasts(this.props.api, this.props.organization.slug);
      this.setState({loading: false, broadcasts: data || []});
    } catch {
      this.setState({loading: false, error: true});
    }

    this.startPoll();
  };

  /**
   * If tab/window loses visibility (note: this is different than focus), stop
   * polling for broadcasts data, otherwise, if it gains visibility, start
   * polling again.
   */
  handleVisibilityChange = () => (document.hidden ? this.stopPoll() : this.startPoll());

  handleShowPanel = () => {
    this.timer = window.setTimeout(this.markSeen, MARK_SEEN_DELAY);
    this.props.onShowPanel();
  };

  markSeen = async () => {
    const unseenBroadcastIds = this.unseenIds;
    if (unseenBroadcastIds.length === 0) {
      return;
    }

    await markBroadcastsAsSeen(this.props.api, unseenBroadcastIds);

    this.setState(state => ({
      broadcasts: state.broadcasts.map(item => ({...item, hasSeen: true})),
    }));
  };

  get unseenIds() {
    return this.state.broadcasts
      ? this.state.broadcasts.filter(item => !item.hasSeen).map(item => item.id)
      : [];
  }

  render() {
    const {orientation, collapsed, currentPanel, showPanel, hidePanel} = this.props;
    const {broadcasts, loading} = this.state;

    const unseenPosts = this.unseenIds;

    return (
      <React.Fragment>
        <SidebarItem
          data-test-id="sidebar-broadcasts"
          orientation={orientation}
          collapsed={collapsed}
          active={currentPanel === 'broadcasts'}
          badge={unseenPosts.length}
          icon={<IconBroadcast size="md" />}
          label={t("What's new")}
          onClick={this.handleShowPanel}
          id="broadcasts"
        />

        {showPanel && currentPanel === 'broadcasts' && (
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
                <SidebarPanelItem
                  key={item.id}
                  hasSeen={item.hasSeen}
                  title={item.title}
                  message={item.message}
                  link={item.link}
                  cta={item.cta}
                />
              ))
            )}
          </SidebarPanel>
        )}
      </React.Fragment>
    );
  }
}

export default withApi(Broadcasts);
