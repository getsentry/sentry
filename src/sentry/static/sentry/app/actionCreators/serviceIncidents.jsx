import ConfigStore from 'app/stores/configStore';
import ServiceIncidentActions from 'app/actions/serviceIncidentActions';

function getIncidentsFromIncidentResponse(incidents) {
  if (incidents === null || incidents.length === 0) {
    return [[], 'none'];
  }

  let isMajor = false;
  const log = [];
  incidents.forEach(item => {
    if (!isMajor && item.impact === 'major') {
      isMajor = true;
    }
    log.push({
      name: item.name,
      updates: item.incident_updates.map(update => {
        return update.body;
      }),
      url: item.shortlink,
      status: item.status,
    });
  });

  return [log, isMajor ? 'major' : 'minor'];
}

export async function load() {
  const cfg = ConfigStore.get('statuspage');
  if (cfg && cfg.id) {
    ServiceIncidentActions.update();

    const response = await fetch(
      `https://${cfg.id}.${cfg.api_host}/api/v2/incidents/unresolved.json`
    );
    if (response.ok) {
      const data = await response.json();
      const [incidents, indicator] = getIncidentsFromIncidentResponse(data.incidents);
      ServiceIncidentActions.updateSuccess({
        status: {
          incidents,
          indicator,
          url: data.page.url,
        },
      });
    } else {
      ServiceIncidentActions.updateError({
        status: null,
      });
    }
  }
}
