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

const MARK_SEEN_DELAY = 1000;
const POLLER_DELAY = 60000;

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

  componentWillMount() {
    this.fetchData();
  },

  componentWillUnmount() {
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.poller) {
      window.clearTimeout(this.poller);
      this.poller = null;
    }
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  fetchData() {
    if (this.poller) {
      window.clearTimeout(this.poller);
    }
    this.api.request('/broadcasts/', {
      method: 'GET',
      success: data => {
        this.setState({
          broadcasts: data || [],
          loading: false,
        });
        this.poller = window.setTimeout(this.fetchData, POLLER_DELAY);
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
        this.poller = window.setTimeout(this.fetchData, POLLER_DELAY);
      },
    });
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

    this.api.request('/broadcasts/', {
      method: 'PUT',
      query: {id: unseenBroadcastIds},
      data: {
        hasSeen: '1',
      },
      success: () => {
        this.setState({
          broadcasts: this.state.broadcasts.map(item => {
            item.hasSeen = true;
            return item;
          }),
        });
      },
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
