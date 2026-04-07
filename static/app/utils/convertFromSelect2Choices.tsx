import type {Choices, SelectValue} from 'sentry/types/core';

function isStringList(maybe: string[] | Choices): maybe is string[] {
  return typeof maybe[0] === 'string';
}

/**
 * Converts arg from a `select2` choices array to a `react-select` `options` array
 */
export const convertFromSelect2Choices = (
  choices: string[] | Choices | unknown
): Array<SelectValue<string | number>> | undefined => {
  // TODO(ts): This is to make sure that this function is backwards compatible, ideally,
  // this function only accepts arrays
  if (!Array.isArray(choices)) {
    return undefined;
  }
  if (isStringList(choices)) {
    return choices.map(choice => ({value: choice, label: choice}));
  }
  return choices.map(choice => ({value: choice[0], label: choice[1]}));
};
