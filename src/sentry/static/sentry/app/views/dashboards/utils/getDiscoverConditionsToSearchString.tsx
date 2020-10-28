import {
  NEGATION_OPERATORS,
  NULL_OPERATORS,
  WILDCARD_OPERATORS,
} from 'app/views/discover/data';
import {defined} from 'app/utils';
import {Condition} from 'app/views/discover/types';

const checkIsNegation = operator => NEGATION_OPERATORS.includes(operator);
const checkIsNull = operator => NULL_OPERATORS.includes(operator);
const checkIsWildcard = operator => WILDCARD_OPERATORS.includes(operator);

function getDiscoverConditionToSearchString(condition: Condition) {
  const [field, operator, value] = condition;
  const isNegation = checkIsNegation(operator);
  const negationStr = isNegation ? '!' : '';

  if (checkIsNull(operator)) {
    return `${negationStr}${field}:""`;
  }

  let coercedValue = value;

  if (!defined(coercedValue)) {
    coercedValue = '';
  }

  if (checkIsWildcard(operator)) {
    // Do we support both?
    coercedValue = `${coercedValue}`.replace(/%/g, '*');
  }

  // TODO(billy): Handle number operators on server
  return `${negationStr}${field}:${coercedValue}`;
}

export function getDiscoverConditionsToSearchString(conditions: Condition[] = []) {
  return conditions.map(getDiscoverConditionToSearchString).join(' ').trim();
}
