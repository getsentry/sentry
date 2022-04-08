import ConfigStore from 'sentry/stores/configStore';
import {SentryServiceIncident, SentryServiceStatus} from 'sentry/types';

type IncidentImpact = SentryServiceStatus['indicator'];

/**
 * This is a partial typing of the statuspage API [0]
 *
 * [0]: https://doers.statuspage.io/api/v2/incidents/
 */
type StatuspageIncident = {
  id: string;
  impact: IncidentImpact;
  incident_updates: {body: string}[];
  name: string;
  shortlink: string;
  status: string;
};

function getIncidentsFromIncidentResponse(statuspageIncidents: StatuspageIncident[]): {
  incidents: SentryServiceIncident[];
  indicator: IncidentImpact;
} {
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
  let response: Response | undefined = undefined;
  if (!cfg || !cfg.id) {
    return null;
  }
  try {
    response = await fetch(
      `https://${cfg.id}.${cfg.api_host}/api/v2/incidents/unresolved.json`
    );
  } catch (err) {
    // No point in capturing this as we can't make statuspage come back.
    return null;
  }

  if (!response.ok) {
    // Sometimes statuspage responds with a 500
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
