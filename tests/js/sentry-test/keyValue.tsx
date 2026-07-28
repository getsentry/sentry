import {screen} from 'sentry-test/reactTestingLibrary';

/**
 * The row containing the given key, for asserting on a key and its value together.
 * `KeyValue` renders a definition list, and neither `term` nor `definition` exposes its
 * content as an accessible name, so rows can't be selected by role and name.
 */
export function getKeyValueRow(keyName: string | RegExp): HTMLElement {
  const row = screen.getByText(keyName).closest('dt')?.parentElement;

  if (!row) {
    throw new Error(`Unable to find a KeyValue row for key: ${keyName}`);
  }

  return row;
}

/**
 * The value cell paired with the given key. Use this when the value renders as several
 * elements, so its text is only assertable in aggregate.
 */
export function getKeyValueDefinition(keyName: string | RegExp): HTMLElement {
  const definition = screen.getByText(keyName).closest('dt')?.nextElementSibling;

  if (!(definition instanceof HTMLElement)) {
    throw new Error(`Unable to find a KeyValue value for key: ${keyName}`);
  }

  return definition;
}
