import {jsonrepair} from 'jsonrepair';

export const isValidJson = (str: string) => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
};

export function prettyPrintJsonString(json: string) {
  try {
    return JSON.stringify(JSON.parse(json), null, 4);
  } catch {
    // Attempt to repair the JSON
    try {
      const repairedJson = jsonrepair(json);
      return JSON.stringify(JSON.parse(repairedJson), null, 4);
    } catch {
      return json;
    }
  }
}
