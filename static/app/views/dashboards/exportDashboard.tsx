import {addErrorMessage} from 'sentry/actionCreators/indicator';

import {DashboardDetails} from './types';

const deleteProperties = [
  'createdBy',
  'dateCreated',
  'id',
  'dashboardId',
  'widgetId',
] as const;

async function exportDashboard() {
  try {
    const structure = {
      base_url: null,
      dashboard_id: null,
    };

    const params = getAPIParams(structure);
    const apiUrl = `https://${params.base_url}/api/0/organizations/testorg-az/dashboards/${params.dashboard_id}/`;
    const response = await fetch(apiUrl);
    const jsonData = await response.json();
    const normalized = normalizeData(jsonData);
    normalized.projects = [];

    downloadObjectAsJson(normalized, cleanTitle(normalized.title));
  } catch (error) {
    addErrorMessage(
      'Could not export dashboard. Please wait or try again with a different dashboard'
    );
  }
}

function getAPIParams(structure) {
  const url = window.location.href;
  const regex = {
    base_url: /(\/\/)(.*?)(\/)/,
    dashboard_id: /(dashboard\/)(.*?)(\/)/,
  };

  for (const attr in regex) {
    const match = url.match(regex[attr]);
    if (match?.length) {
      structure[attr] = match.length >= 3 ? match[2] : null;
    }
  }

  return structure;
}

function normalizeData(
  source: DashboardDetails
): Omit<DashboardDetails, (typeof deleteProperties)[number]> {
  const payload: Omit<DashboardDetails, (typeof deleteProperties)[number]> = {
    title: '',
    filters: {},
    projects: [],
    widgets: [],
    environment: [],
  };

  for (const property in payload) {
    if (property in source) {
      let data: any[] = [];

      // if there is a nested object with properties that should be deleted
      if (['widgets'].includes(property)) {
        // get the object properties so that we can loop through them
        const type = getType(property);
        data = normalizeNestedObject(source[property], type);
      } else {
        data = source[property];
      }

      payload[property] = data;
    }
  }

  return payload;
}

function normalizeNestedObject(object, structure) {
  const nestedObjectArray: any[] = [];
  const nestedObject = structure;

  for (const index in object) {
    for (const property in structure) {
      if (property in object[index]) {
        let data: any[] = [];

        if (['queries'].includes(property)) {
          // get the object properties so that we can loop through them
          const type = getType(property);
          data = normalizeNestedObject(object[index][property], type);
        } else {
          data = object[index][property];
        }

        nestedObject[property] = data;
      }
    }

    nestedObjectArray.push(nestedObject);
  }

  return nestedObjectArray;
}

function getType(property) {
  let structure = {};

  switch (property) {
    case 'widgets':
      structure = {
        title: '',
        description: '',
        interval: '',
        queries: [],
        displayType: '',
      };
      break;
    case 'queries':
      structure = {
        aggregates: [],
        columns: [],
        conditions: [],
        name: '',
        orderby: '',
        fieldAliases: [],
        fields: [],
      };
      break;
    default:
      structure = {};
  }

  return structure;
}

function downloadObjectAsJson(exportObj, exportName) {
  const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(exportObj)
  )}`;
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute('href', dataStr);
  downloadAnchorNode.setAttribute('download', `${exportName}.json`);
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

function cleanTitle(title) {
  const regex = /[^a-z0-9]/gi;
  const formattedTitle = title.replace(regex, '-');
  const date = new Date();
  return `${formattedTitle}-${date.toISOString()}`;
}

export default exportDashboard;
