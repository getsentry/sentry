import {
  initialSelectors,
  valueSuggestions,
  binaryOperatorSuggestions,
  unaryOperatorSuggestions,
  SuggestionType,
  Suggestion,
} from './dataPrivacyRulesPanelSelectorFieldTypes';

type Output = {
  filteredSuggestions: Array<Suggestion>;
  showSuggestions?: boolean;
};

const getFilteredSuggestions = (value: string, type: SuggestionType) => {
  let valuesToBeFiltered: Array<Suggestion> = [];

  switch (type) {
    case 'binary': {
      valuesToBeFiltered = binaryOperatorSuggestions;
      break;
    }
    case 'value': {
      valuesToBeFiltered = valueSuggestions;
      break;
    }
    case 'unary': {
      valuesToBeFiltered = unaryOperatorSuggestions;
      break;
    }
    default: {
      valuesToBeFiltered = initialSelectors;
    }
  }

  const filteredSuggestions = valuesToBeFiltered.filter(
    s => s.value.indexOf(value.toLowerCase()) > -1
  );

  return {
    filteredSuggestions,
    showSuggestions: !(
      filteredSuggestions.length === 1 && filteredSuggestions[0].value === value
    ),
  };
};

function getNewSuggestions(fieldValues: Array<Suggestion | Array<Suggestion>>): Output {
  const lastFieldValue = fieldValues[fieldValues.length - 1];
  const penultimateFieldValue = fieldValues[fieldValues.length - 2];

  if (Array.isArray(lastFieldValue)) {
    // recursion
    return getNewSuggestions(lastFieldValue);
  }

  if (Array.isArray(penultimateFieldValue)) {
    if (lastFieldValue?.type === 'binary') {
      // returns filteres values
      return getFilteredSuggestions(lastFieldValue?.value, 'value');
    }
    // returns all binaries without any filter
    return getFilteredSuggestions('', 'binary');
  }

  if (lastFieldValue?.type === 'value' && penultimateFieldValue?.type === 'unary') {
    // returns filteres values
    return getFilteredSuggestions(lastFieldValue?.value, 'value');
  }

  if (lastFieldValue?.type === 'unary') {
    // returns all values without any filter
    return getFilteredSuggestions('', 'value');
  }

  if (lastFieldValue?.type === 'string' && penultimateFieldValue?.type === 'value') {
    // returns all binaries without any filter
    return getFilteredSuggestions('', 'binary');
  }

  if (
    (penultimateFieldValue?.type === 'string' && !lastFieldValue?.value) ||
    (penultimateFieldValue?.type === 'value' && !lastFieldValue?.value) ||
    lastFieldValue?.type === 'binary'
  ) {
    // returns filteres binaries
    return getFilteredSuggestions(lastFieldValue?.value, 'binary');
  }

  return getFilteredSuggestions(lastFieldValue?.value, lastFieldValue?.type);
}

export default getNewSuggestions;
