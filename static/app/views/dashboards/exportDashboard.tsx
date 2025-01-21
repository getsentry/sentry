import cloneDeep from 'lodash/cloneDeep';

import {addErrorMessage} from 'sentry/actionCreators/indicator';

import type {DashboardDetails} from './types';

type ExcludedProperties = 'createdBy' | 'dateCreated' | 'id' | 'dashboardId' | 'widgetId';

async function exportDashboard() {
  try {
    const structure = {
      base_url: null,
      dashboard_id: null,
      org_slug: null,
    };

    const params = getAPIParams(structure);
    const apiUrl = `https://${params.base_url}/api/0/organizations/${params.org_slug}/dashboards/${params.dashboard_id}/`;
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

function getAPIParams(structure: any) {
  const url = window.location.href;
  const regex = {
    base_url: /(\/\/)(.*?)(\/)/,
    dashboard_id: /(dashboard\/)(.*?)(\/)/,
    org_slug: /(\/\/)(.+?)(?=\.)/,
  };

  for (const attr in regex) {
    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const match = url.match(regex[attr]);
    if (match?.length) {
      structure[attr] = match.length >= 3 ? match[2] : null;
    }
  }

  return structure;
}

function normalizeData(
  source: DashboardDetails
): Omit<DashboardDetails, ExcludedProperties> {
  const payload: Omit<DashboardDetails, ExcludedProperties> = {
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
        const type = getPropertyStructure(property);
        // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        data = normalizeNestedObject(source[property], type);
      } else {
        // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        data = source[property];
      }

      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      payload[property] = data;
    }
  }

  return payload;
}

function normalizeNestedObject(object: any, structure: any) {
  const nestedObjectArray: any[] = [];

  for (const index in object) {
    const nestedObject = cloneDeep(structure);

    for (const property in structure) {
      if (property in object[index]) {
        let data: any[] = [];

        if (['queries'].includes(property)) {
          // get the object properties so that we can loop through them
          const type = getPropertyStructure(property);
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

function getPropertyStructure(property: any) {
  let structure = {};

  switch (property) {
    case 'widgets':
      structure = {
        title: '',
        description: '',
        interval: '',
        queries: [],
        displayType: '',
        widgetType: '',
        layout: [],
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

function downloadObjectAsJson(exportObj: any, exportName: any) {
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

function cleanTitle(title: any) {
  const regex = /[^a-z0-9]/gi;
  const formattedTitle = title.replace(regex, '-');
  const date = new Date();
  return `${formattedTitle}-${date.toISOString()}`;
}

export default exportDashboard;
