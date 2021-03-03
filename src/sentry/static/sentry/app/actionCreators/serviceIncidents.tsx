import ConfigStore from 'app/stores/configStore';
import {SentryServiceIncident, SentryServiceStatus} from 'app/types';

type IncidentImpact = SentryServiceStatus['indicator'];

/**
 * This is a partial typing of the statuspage API [0]
 *
 * [0]: https://doers.statuspage.io/api/v2/incidents/
 */
type StatuspageIncident = {
  id: string;
  name: string;
  status: string;
  impact: IncidentImpact;
  shortlink: string;
  incident_updates: {body: string}[];
};

function getIncidentsFromIncidentResponse(
  statuspageIncidents: StatuspageIncident[]
): {incidents: SentryServiceIncident[]; indicator: IncidentImpact} {
  if (statuspageIncidents === null || statuspageIncidents.length === 0) {
    return {incidents: [], indicator: 'none'};
  }

  let isMajor = false;
  const incidents: SentryServiceIncident[] = [];

  statuspageIncidents.forEach(item => {
    if (!isMajor && item.impact === 'major') {
      isMajor = true;
    }
    incidents.push({
      id: item.id,
      name: item.name,
      updates: item.incident_updates.map(update => update.body),
      url: item.shortlink,
      status: item.status,
    });
  });

  return {incidents, indicator: isMajor ? 'major' : 'minor'};
}

export async function loadIncidents(): Promise<SentryServiceStatus | null> {
  const cfg = ConfigStore.get('statuspage');
  if (!cfg || !cfg.id) {
    return null;
  }
  const response = await fetch(
    `https://${cfg.id}.${cfg.api_host}/api/v2/incidents/unresolved.json`
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const {incidents, indicator} = getIncidentsFromIncidentResponse(data.incidents);

  return {
    incidents,
    indicator,
    url: data.page.url,
  };
}
