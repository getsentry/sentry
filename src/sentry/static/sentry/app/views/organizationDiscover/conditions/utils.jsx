import moment from 'moment';

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

  const colType = (cols.find(col => col.name === condition[0]) || {}).type;

  const isValueValid =
    specialConditions.has(condition[1]) ||
    (colType === 'datetime' && condition[2] !== null) ||
    colType === typeof condition[2];

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
export function getExternal(internal, columns) {
  internal = internal || '';
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
    CONDITION_OPERATORS.forEach(operator => {
      if (remaining.startsWith(operator)) {
        external[1] = operator;
      }
    });
  }

  // Validate value and convert to correct type
  if (external[0] && external[1] && !specialConditions.has(external[1])) {
    const strStart = `${external[0]} ${external[1]} `;

    if (internal.startsWith(strStart)) {
      external[2] = internal.replace(strStart, '');
    }

    const type = columns.find(({name}) => name === colValue).type;

    if (type === 'number') {
      const num = parseInt(external[2], 10);
      external[2] = !isNaN(num) ? num : null;
    }

    if (type === 'boolean') {
      if (external[2] === 'true') {
        external[2] = true;
      }
      if (external[2] === 'false') {
        external[2] = false;
      }
    }

    if (type === 'datetime') {
      const date = moment.utc(external[2]);
      external[2] = date.isValid() ? date.format('YYYY-MM-DDTHH:mm:ss') : null;
    }
  }

  return external;
}

/**
* Transform casing of condition operators to uppercase. Applies to the operators
* IS NULL, IS NOT NULL, LIKE and NOT LIKE
*
* @param {String} input Condition string as input by user
* @returns {String}
*/

export function ignoreCase(input = '') {
  const colName = input.split(' ')[0];

  // Strip column name from the start
  const match = input.match(/^[\w._]+\s(.*)/);
  let remaining = match ? match[1] : null;

  if (!remaining) {
    return input;
  }

  for (let i = 0; i < CONDITION_OPERATORS.length; i++) {
    const operator = CONDITION_OPERATORS[i];

    if (operator.startsWith(remaining.toUpperCase())) {
      return `${colName} ${remaining.toUpperCase()}`;
    } else if (remaining.toUpperCase().startsWith(operator)) {
      return `${colName} ${operator} ${remaining.slice(operator.length + 1)}`;
    }
  }

  return input;
}
