import type {Choices, SelectValue} from 'sentry/types/core';

type Input = number | string | undefined | Record<any, any> | string[] | Choices;

function isStringList(maybe: string[] | Choices): maybe is string[] {
  return typeof maybe[0] === 'string';
}

/**
 * Converts arg from a `select2` choices array to a `react-select` `options` array
 * This contains some any hacks as this is creates type errors with the generics
 * used in SelectControl as the generics conflict with the concrete types here.
 */
const convertFromSelect2Choices = (
  choices: Input
): Array<SelectValue<any>> | undefined => {
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

export default convertFromSelect2Choices;
