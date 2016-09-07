import React from 'react';
import jQuery from 'jquery';

import ConfigStore from '../../stores/configStore';
import DropdownLink from '../dropdownLink';
import {t} from '../../locale';

const StatusPage = React.createClass({

  getInitialState() {
    return {
      status: null,
      isLoading: false
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  getConfig() {
    return ConfigStore.get('statuspage');
  },

  getIncidentsFromIncidentResponse(incidents) {
    if (incidents === null || incidents.length == 0) {
      return [[], 'none'];
    }

    let isMajor = false;
    let log = [];
    incidents.forEach((item) => {
      if (!isMajor && item.impact === 'major') {
        isMajor = true;
      }
      log.push({
        name: item.name,
        updates: item.incident_updates.map((update) => {
          return update.body;
        }),
        url: item.shortlink,
        status: item.status
      });
    });

    return [log, isMajor ? 'major' : 'minor'];
  },

  fetchData(callback) {
    let cfg = this.getConfig();
    if (cfg && cfg.id) {
      this.setState({
        isLoading: true
      });
      jQuery.ajax({
        type: 'GET',
        url: 'https://' + cfg.id + '.' + cfg.api_host + '/api/v2/incidents/unresolved.json',
        crossDomain: true,
        cache: false,
        success: (data) => {
          let [incidents, indicator] = this.getIncidentsFromIncidentResponse(
            data.incidents);
          this.setState({
            isLoading: false,
            status: {
              incidents: incidents,
              indicator: indicator,
              url: data.page.url
            }
          });
        },
        error: () => {
          this.setState({
            isLoading: false,
            status: null
          });
        }
      });
    }
    return;
  },

  isDisabled() {
    return this.getConfig() === null;
  },

  getIconClass() {
    let status = this.state.status;
    if (!status || status.indicator == 'none') {
      return null;
    } else if (status.indicator == 'minor') {
      return 'icon-triangle';
    } else if (status.indicator == 'major') {
      return 'icon-exclamation';
    }
    return null;
  },

  render() {
    if (this.isDisabled() || this.state.isLoading) {
      return null;
    }

    let icon = this.getIconClass();
    if (icon === null) {
      return null;
    }

    let title = <span className={icon} />;
    let items = this.state.status.incidents.map((incident, i) => {
      return (
        <li key={i} className="incident">
          <strong>{incident.name}</strong> [{incident.status}]
          <ul>
            {incident.updates.map((update, j) => {
              return (
                <li key={j}>{update}</li>
              );
            })}
          </ul>
          <a href={incident.url} target="_blank">{t('Read more …')}</a>
        </li>
      );
    });

    return (
      <DropdownLink
          topLevelClasses={`statuspage ${this.props.className || ''}`}
          menuClasses="dropdown-menu-right"
          title={title}>
        {items}
      </DropdownLink>
    );
  }
});

export default StatusPage;
