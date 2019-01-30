import {
  NEGATION_OPERATORS,
  NULL_OPERATORS,
  WILDCARD_OPERATORS,
} from 'app/views/organizationDiscover/data';
import {defined} from 'app/utils';

const checkIsNegation = operator => NEGATION_OPERATORS.includes(operator);
const checkIsNull = operator => NULL_OPERATORS.includes(operator);
const checkIsWildcard = operator => WILDCARD_OPERATORS.includes(operator);

function getDiscoverConditionToSearchString(condition = []) {
  let [field, operator, value] = condition;
  const isNegation = checkIsNegation(operator);
  const negationStr = isNegation ? '!' : '';

  if (checkIsNull(operator)) {
    return `${negationStr}${field}:""`;
  }

  if (!defined(value)) {
    value = '';
  }

  if (checkIsWildcard(operator)) {
    // Do we support both?
    value = value.replace(/%/g, '*');
  }

  // TODO(billy): Handle number operators on server
  return `${negationStr}${field}:${value}`;
}

export function getDiscoverConditionsToSearchString(conditions = []) {
  return conditions
    .map(getDiscoverConditionToSearchString)
    .join(' ')
    .trim();
}
