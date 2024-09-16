export const isValidJson = (str: string) => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
};

export function prettyPrintJsonString(json: string) {
  return JSON.stringify(JSON.parse(json), null, 4);
}
