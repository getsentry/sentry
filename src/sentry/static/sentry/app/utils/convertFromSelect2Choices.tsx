import {Choices, SelectValue} from 'app/types';

type Input = undefined | string[] | Choices;

function isStringList(maybe: string[] | Choices): maybe is string[] {
  return typeof maybe[0] === 'string';
}

/**
 * Converts arg from a `select2` choices array to a `react-select` `options` array
 */
const convertFromSelect2Choices = (choices: Input): SelectValue<any>[] | null => {
  // TODO(ts): This is to make sure that this function is backwards compatible, ideally,
  // this function only accepts arrays
  if (!Array.isArray(choices)) {
    return null;
  }
  if (isStringList(choices)) {
    return choices.map(choice => ({value: choice, label: choice}));
  }
  return choices.map(choice => ({value: choice[0], label: choice[1]}));
};

export default convertFromSelect2Choices;
