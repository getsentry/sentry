import {CONDITION_OPERATORS} from '../data';

const specialConditions = new Set(['IS NULL', 'IS NOT NULL']);

/**
 * Returns true if a condition is valid and false if not
 *
 * @param {Array} condition Condition in external Snuba format
 * @param {Object} cols List of column objects
 * @param {String} cols.name Column name
 * @param {String} cols.type Type of column
 * @returns {Boolean} True if valid condition, false if not
 */
export function isValidCondition(condition, cols) {
  const allOperators = new Set(CONDITION_OPERATORS);
  const columns = new Set(cols.map(({name}) => name));

  const isColValid = columns.has(condition[0]);
  const isOperatorValid = allOperators.has(condition[1]);

  const isValueValid =
    specialConditions.has(condition[1]) ||
    typeof condition[2] === (cols.find(col => col.name === condition[0]) || {}).type;

  return isColValid && isOperatorValid && isValueValid;
}

/***
* Converts external Snuba format to internal format for dropdown
*
* @param {Array} condition Condition in external Snuba format
* @param {Array} cols List of columns with name and type e.g. {name: 'message', type: 'string}
* @returns {String}
*/
export function getInternal(external) {
  return external.join(' ').trim();
}

/***
* Converts internal dropdown format to external Snuba format
*
* @param {String} internal Condition in internal format
* @param {Array} {Array} cols List of columns with name and type e.g. {name: 'message', type: 'string}
* @returns {Array} condition Condition in external Snuba format
*/
export function getExternal(internal = '', columns) {
  const external = [null, null, null];

  // Validate column
  const colValue = internal.split(' ')[0];
  if (new Set(columns.map(({name}) => name)).has(colValue)) {
    external[0] = colValue;
  }

  // Validate operator
  const remaining = (external[0] !== null
    ? internal.replace(external[0], '')
    : internal
  ).trim();

  // Check IS NULL and IS NOT NULL first
  if (specialConditions.has(remaining)) {
    external[1] = remaining;
  } else {
    const operatorMatch = remaining.match(/^([^\s]+).*$/);
    const operatorValue = operatorMatch ? operatorMatch[1] : null;

    if (new Set(CONDITION_OPERATORS).has(operatorValue)) {
      external[1] = operatorValue;
    }
  }

  // Validate value and convert to correct type
  if (external[0] && external[1] && !specialConditions.has(external[1])) {
    const valuesMatch = internal.match(/^[a-zA-Z0-9_\.:-]+ [^\s]+ (.*)$/);
    external[2] = valuesMatch ? valuesMatch[1] : null;
    const type = columns.find(({name}) => name === colValue).type;

    if (type === 'number') {
      external[2] = parseInt(external[2], 10) || null;
    }
  }

  return external;
}
