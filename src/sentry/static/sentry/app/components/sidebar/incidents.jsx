import React from 'react';
import Reflux from 'reflux';

import SidebarItem from './sidebarItem';
import SidebarPanel from './sidebarPanel';

import IncidentStore from '../../stores/incidentStore';
import {t} from '../../locale';

import IconSidebarStatus from '../../icons/icon-sidebar-status';

const Incidents = React.createClass({
  propTypes: {
    showPanel: React.PropTypes.bool,
    currentPanel: React.PropTypes.string,
    hidePanel: React.PropTypes.func,
    onShowPanel: React.PropTypes.func.isRequired
  },

  mixins: [Reflux.listenTo(IncidentStore, 'onIncidentChange')],

  getInitialState() {
    return {
      status: null
    };
  },

  onIncidentChange(status) {
    this.setState({
      status: {...status}
    });
  },

  render() {
    let {status} = this.state;
    if (!status) return null;

    return (
      <div>
        <SidebarItem
          active={this.props.currentPanel == 'statusupdate'}
          icon={<IconSidebarStatus size={22} className="animated pulse infinite" />}
          label={t('Service status')}
          onClick={() => this.props.onShowPanel()}
        />
        {this.props.showPanel &&
          this.props.currentPanel == 'statusupdate' &&
          status &&
          <SidebarPanel
            title={t('Recent status updates')}
            hidePanel={this.props.hidePanel}>
            <ul className="incident-list list-unstyled">
              {status.incidents.map(incident => (
                <li className="incident-item" key={incident.id}>
                  <h4>{incident.title}</h4>
                  {incident.updates
                    ? <div>
                        <h6>Latest updates:</h6>
                        <ul className="status-list list-unstyled">
                          {incident.updates.map((update, key) => (
                            <li className="status-item" key={key}>
                              <p>{update}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    : null}
                  <p>
                    <a href={incident.url} className="btn btn-default btn-sm">
                      Learn more
                    </a>
                  </p>
                </li>
              ))}
            </ul>
          </SidebarPanel>}
      </div>
    );
  }
});

export default Incidents;
