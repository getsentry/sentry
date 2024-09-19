import {jsonrepair} from 'jsonrepair';

export const isValidJson = (str: string) => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
};

export function prettyPrintJsonString(json: string): {
  failed: boolean;
  isTruncated: boolean;
  prettifiedQuery: string;
} {
  try {
    return {
      prettifiedQuery: JSON.stringify(JSON.parse(json), null, 4),
      isTruncated: false,
      failed: false,
    };
  } catch {
    // Attempt to repair the JSON
    try {
      const repairedJson = jsonrepair(json);
      return {
        prettifiedQuery: JSON.stringify(JSON.parse(repairedJson), null, 4),
        isTruncated: true,
        failed: false,
      };
    } catch {
      return {prettifiedQuery: json, isTruncated: false, failed: true};
    }
  }
}
