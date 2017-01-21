import React from 'react';
import Reflux from 'reflux';

import SidebarPanel from '../sidebarPanel';

import IncidentStore from '../../stores/incidentStore';
import {t} from '../../locale';

const Incidents = React.createClass({
  propTypes: {
    showPanel: React.PropTypes.bool,
    currentPanel: React.PropTypes.string,
    hidePanel: React.PropTypes.func,
    onShowPanel: React.PropTypes.func.isRequired
  },

  mixins: [
    Reflux.listenTo(IncidentStore, 'onIncidentChange'),
  ],

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

    return status && status.incidents.length > 0 &&
      <li className={this.props.currentPanel == 'statusupdate' ? 'active' : null }>
        <a onClick={this.props.onShowPanel}><span className="icon icon-alert animated pulse infinite"/></a>
        {this.props.showPanel && this.props.currentPanel == 'statusupdate' && status &&
          <SidebarPanel title={t('Recent status updates')}
                        hidePanel={this.props.hidePanel}>
            <ul className="incident-list list-unstyled">
              {status.incidents.map((incident) =>
                <li className="incident-item" key={incident.id}>
                  <h4>{incident.title}</h4>
                  {incident.updates ?
                    <div>
                      <h6>Latest updates:</h6>
                      <ul className="status-list list-unstyled">
                        {incident.updates.map((update, key) =>
                          <li className="status-item" key={key}>
                            <p>{update}</p>
                          </li>
                        )}
                      </ul>
                    </div>
                    :
                    null
                  }
                  <p>
                    <a href={incident.url} className="btn btn-default btn-sm">Learn more</a>
                  </p>
                </li>
              )}
            </ul>
          </SidebarPanel>
        }
      </li>;
  }
});

export default Incidents;
