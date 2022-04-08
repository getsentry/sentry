import {importProfile, ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {importTypeScriptTypesJSON} from 'sentry/utils/profiling/profile/typescript/importTypeScriptTypesJSON';

const tryParseInputString: JSONParser = input => {
  try {
    return [JSON.parse(input), null];
  } catch (e) {
    return [null, e];
  }
};

type JSONParser = (input: string) => [any, null] | [null, Error];
const TRACE_JSON_PARSERS: ((string) => ReturnType<JSONParser>)[] = [
  (input: string) => tryParseInputString(input),
  (input: string) => tryParseInputString(input + ']'),
];

function readFileAsString(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', (e: ProgressEvent<FileReader>) => {
      if (typeof e.target?.result === 'string') {
        resolve(e.target.result);
        return;
      }

      reject('Failed to read string contents of input file');
    });

    reader.addEventListener('error', () => {
      reject('Failed to read string contents of input file');
    });

    reader.readAsText(file);
  });
}

export async function importDroppedFile(
  file: File,
  parsers: JSONParser[] = TRACE_JSON_PARSERS
): Promise<ProfileGroup | TypeScriptTypes.TypeTree> {
  const fileContents = await readFileAsString(file);

  for (const parser of parsers) {
    const [json] = parser(fileContents);

    if (json) {
      if (typeof json !== 'object' || json === null) {
        throw new TypeError('Input JSON is not an object');
      }

      try {
        return importProfile(json, file.name);
      } catch (e) {
        // Fallthrough
      }

      try {
        return importTypeScriptTypesJSON(json);
      } catch (e) {
        // Fallthrough
      }
    }
  }

  throw new Error('Failed to parse input JSON');
}
