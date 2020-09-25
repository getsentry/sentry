import {SelectValue} from 'app/types';

type Choices = string[] | [string, string][] | any;

/**
 * Converts arg from a `select2` choices array to a `react-select` `options` array
 */
const convertFromSelect2Choices = (choices: Choices): SelectValue<any>[] | null => {
  if (!Array.isArray(choices)) {
    return null;
  }

  // Accepts an array of strings or an array of tuples
  return choices.map(choice =>
    Array.isArray(choice)
      ? {value: choice[0], label: choice[1]}
      : {value: choice, label: choice}
  );
};

export default convertFromSelect2Choices;
