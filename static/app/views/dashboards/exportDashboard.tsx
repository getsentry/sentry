const delete_properties = ['createdBy', 'dateCreated', 'id', 'dashboardId', 'widgetId'];

async function exportDashboard() {
  const params = getAPIParams();
  const api_url = `https://${params.base_url}/api/0/organizations/testorg-az/dashboards/${params.dashboard_id}/`;
  const response = await fetch(api_url);
  const jsonData = await response.json();
  const normalized = normalize_data(jsonData);
  normalized.projects = [];
  downloadObjectAsJson(normalized, 'dashboard');
}

function getAPIParams() {
  const url = window.location.href;
  const regex = {
    base_url: /(\/\/)(.*?)(\/)/,
    dashboard_id: /(dashboard\/)(.*?)(\/)/,
    org_slug: /(\/\/)(.*?)(.sentry.io\/)/,
  };
  const response = {};

  for (const attr in regex) {
    const match = url.match(regex[attr]);
    if (match?.length) {
      response[attr] = match.length >= 3 ? match[2] : null;
    }
  }

  return response;
}

function normalize_data(source) {
  const payload = {};
  type Nullable<T> = T | null;

  let last_data_attr: Nullable<string> = null;
  for (let data in source) {
    if (Array.isArray(source[data]) && source[data].length !== 0) {
      for (const attr in source[data]) {
        if (typeof source[data] === 'undefined') {
          continue;
        }
        if (!payload.hasOwnProperty(data)) {
          payload[data] = [];
        }

        if (typeof source[data][attr] !== 'string') {
          if (last_data_attr === null) {
            last_data_attr = data;
          }

          if (last_data_attr !== null) {
            payload[last_data_attr].push(normalize_data(source[data][attr]));
            data = String(last_data_attr);
            last_data_attr = null;
          }
        } else {
          payload[data].push(source[data][attr]);
        }
      }
    } else {
      if (!delete_properties.includes(data)) {
        if (data === 'limit' && source[data] === null) {
          payload[data] = 5;
        } else {
          payload[data] = source[data];
        }
      }
    }
  }

  return payload;
}

function downloadObjectAsJson(exportObj, exportName) {
  const dataStr =
    'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObj));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute('href', dataStr);
  downloadAnchorNode.setAttribute('download', exportName + '.json');
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

export default exportDashboard;
