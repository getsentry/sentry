import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import {t} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import InlineSvg from 'app/components/inlineSvg';
import LoadingIndicator from 'app/components/loadingIndicator';
import SidebarItem from 'app/components/sidebar/sidebarItem';
import SidebarPanel from 'app/components/sidebar/sidebarPanel';
import SidebarPanelEmpty from 'app/components/sidebar/sidebarPanelEmpty';
import SidebarPanelItem from 'app/components/sidebar/sidebarPanelItem';
import * as broadcastActions from 'app/actionCreators/broadcasts';

const MARK_SEEN_DELAY = 1000;
const POLLER_DELAY = 600000; // 10 minute poll (60 * 10 * 1000)

const Broadcasts = createReactClass({
  displayName: 'Broadcasts',

  propTypes: {
    orientation: PropTypes.oneOf(['top', 'left']),
    collapsed: PropTypes.bool,
    showPanel: PropTypes.bool,
    currentPanel: PropTypes.string,
    hidePanel: PropTypes.func,
    onShowPanel: PropTypes.func.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      broadcasts: [],
      loading: true,
      error: false,
    };
  },

  componentDidMount() {
    this.fetchData();

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  },

  componentWillUnmount() {
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.poller) {
      this.stopPoll();
    }
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  fetchData() {
    if (this.poller) {
      this.stopPoll();
    }

    return broadcastActions
      .getAll(this.api)
      .then(data => {
        this.setState({
          broadcasts: data || [],
          loading: false,
        });
        this.startPoll();
      })
      .catch(() => {
        this.setState({
          loading: false,
          error: true,
        });
        this.startPoll();
      });
  },

  startPoll() {
    this.poller = window.setTimeout(this.fetchData, POLLER_DELAY);
  },

  stopPoll() {
    window.clearTimeout(this.poller);
    this.poller = null;
  },

  /**
   * If tab/window loses visiblity (note: this is different than focus), stop polling for broadcasts data, otherwise,
   * if it gains visibility, start polling again.
   */
  handleVisibilityChange() {
    if (document.hidden) {
      this.stopPoll();
    } else {
      this.startPoll();
    }
  },

  handleShowPanel() {
    this.timer = window.setTimeout(this.markSeen, MARK_SEEN_DELAY);
    this.props.onShowPanel();
  },

  getUnseenIds() {
    if (!this.state.broadcasts) return [];

    return this.state.broadcasts
      .filter(item => {
        return !item.hasSeen;
      })
      .map(item => {
        return item.id;
      });
  },

  markSeen() {
    let unseenBroadcastIds = this.getUnseenIds();
    if (unseenBroadcastIds.length === 0) return;

    broadcastActions.markAsSeen(this.api, unseenBroadcastIds).then(data => {
      this.setState({
        broadcasts: this.state.broadcasts.map(item => {
          item.hasSeen = true;
          return item;
        }),
      });
    });
  },

  render() {
    let {orientation, collapsed, currentPanel, showPanel, hidePanel} = this.props;
    let {broadcasts, loading} = this.state;

    let unseenPosts = this.getUnseenIds();

    return (
      <React.Fragment>
        <SidebarItem
          data-test-id="sidebar-broadcasts"
          orientation={orientation}
          collapsed={collapsed}
          active={currentPanel == 'broadcasts'}
          badge={unseenPosts.length}
          icon={<InlineSvg src="icon-broadcast" size="22px" />}
          label={t("What's new")}
          onClick={this.handleShowPanel}
        />

        {showPanel &&
          currentPanel == 'broadcasts' && (
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
                broadcasts.map(item => {
                  return (
                    <SidebarPanelItem
                      key={item.id}
                      hasSeen={item.hasSeen}
                      title={item.title}
                      message={item.message}
                      link={item.link}
                    />
                  );
                })
              )}
            </SidebarPanel>
          )}
      </React.Fragment>
    );
  },
});

export default Broadcasts;
