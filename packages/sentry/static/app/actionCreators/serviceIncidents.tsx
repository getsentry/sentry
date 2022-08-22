import ConfigStore from 'sentry/stores/configStore';
import {SentryServiceIncident, SentryServiceStatus} from 'sentry/types';

type IncidentImpact = SentryServiceStatus['indicator'];

/**
 * This is a partial typing of the statuspage API [0]
 *
 * [0]: https://doers.statuspage.io/api/v2/incidents/
 */
type StatuspageIncident = {
  created_at: string;
  id: string;
  impact: IncidentImpact;
  name: string;
  shortlink: string;
  status: string;
  components?: Array<any>;
  incident_updates?: Array<any>;
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
      createdAt: item.created_at,
      updates:
        item.incident_updates?.map(update => ({
          body: update.body,
          status: update.status,
          updatedAt: update.updated_at,
        })) ?? [],
      affectedComponents:
        item.components?.map(componentUpdate => ({
          name: componentUpdate.name,
          status: componentUpdate.status,
          updatedAt: componentUpdate.updated_at,
        })) ?? [],
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
