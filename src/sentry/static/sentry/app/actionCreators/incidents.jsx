import ConfigStore from '../stores/configStore';
import IncidentActions from '../actions/incidentActions';
import $ from 'jquery';

function getIncidentsFromIncidentResponse(incidents) {
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
}

export function load() {
  let cfg = ConfigStore.get('statuspage');
  if (cfg && cfg.id) {
    IncidentActions.update();

    $.ajax({
      type: 'GET',
      url: 'https://' + cfg.id + '.' + cfg.api_host + '/api/v2/incidents/unresolved.json',
      crossDomain: true,
      cache: false,
      success: (data) => {
        let [incidents, indicator] = getIncidentsFromIncidentResponse(data.incidents);
        IncidentActions.updateSuccess({
          status: {
            incidents: incidents,
            indicator: indicator,
            url: data.page.url
          }
        });
      },
      error: () => {
        IncidentActions.updateError({
          status: null
        });
      }
    });
  }
}
