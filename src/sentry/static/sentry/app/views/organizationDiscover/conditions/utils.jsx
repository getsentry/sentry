import moment from 'moment';

import {CONDITION_OPERATORS} from '../data';

const specialConditions = new Set(['IS NULL', 'IS NOT NULL']);
const specialLikeConditions = new Set(['LIKE', 'NOT LIKE']);


/*
* event_id lik -> event_id LIK
* event_id is nul -> event_id IS NUL
*
* */

export function ignoreCaseInput(input, external){
  let colName = input.split(' ')[0];

  // let remaining = external && external[1]
  //   ? [external[1], input.split(external[1])[1]].join(' ')
  //   : input.split(' ').slice(1).join(' ').toUpperCase();
  //

  let remaining, result, excess;
  if(external && external[1]) { //does not work because once external[1] is complete, doesn't hit here unless has another arg
    let strStart = `${external[0]} ${external[1]}`;
    console.log('strstart', strStart);
    // remaining = input.split(external[1].toLowerCase())[1];
    remaining = input.replace(strStart.toLowerCase().trim(), '');
    result = [strStart, remaining].join(' ');
    console.log('if EXTERNAL: ', 'INPUT: ', input, 'remaining: ', remaining, 'result: ', result);
  } else {
    remaining = input.split(' ').slice(1).join(' ').toUpperCase();
    result =  remaining ? [colName, remaining].join(' ') : input;
    console.log('else', 'remaining: ', remaining, 'result: ', result, 'external', external);
  }
  // remaining = input.replace(colName, '');
  //
  // if(colName){
  //   CONDITION_OPERATORS.forEach(operator => {
  //     if (remaining.startsWith(operator) || remaining.startsWith(operator.toUpperCase())) {
  //       external[1] = operator;
  //     }
  //   })
  //
  //   specialLikeConditions.forEach(operator => {
  //     if(remaining.toUpperCase().startsWith(operator)) {
  //       remaining.replace(operator.toLowerCase(), operator);
  //     }
  //   });
  //
  //   CONDITION_OPERATORS.forEach(operator => {
  //     if(remaining.toUpperCase().startsWith(operator)) {
  //       remaining.replace(operator.toLowerCase(), operator);
  //     }
  //   });
  //   result = [colName, remaining].join(' ');
  //
  // } else {
  //   result = input;
  // }



  // console.log('remaining is...', remaining);
  // remaining = input.split(' ').slice(1).join(' ').toUpperCase();
  //   // : [external[1], input.split(external[1])[1]].join(' ');
  // result = remaining ? [colName, remaining].join(' ') : input;
  return result;
  return input;
}


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

  const isOperatorValid = condition[1] && allOperators.has(condition[1].toUpperCase());

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
  let remaining = (external[0] !== null
    ? internal.replace(external[0], '')
    : internal
  ).trim();


  // if(!specialLikeConditions.has(remaining) && specialLikeConditions.has(remaining.toUpperCase())) {
  //   console.log('old internal', internal)
  //   internal = ignoreCaseInput(internal, external);
  //   console.log('new internal', internal)
  // }

  if (remaining.toUpperCase().startsWith('LIKE')) {
    internal = internal.replace('like', 'like'.toUpperCase());
    remaining = remaining.replace('like', 'like'.toUpperCase());
  }

  if (remaining.toUpperCase().startsWith('NOT LIKE')) {
    internal = internal.replace('not like', 'not like'.toUpperCase());
    remaining = remaining.replace('not like', 'not like'.toUpperCase());
  }

  // Check IS NULL and IS NOT NULL first
  if (specialConditions.has(remaining)) {
    external[1] = remaining;
  } else {
    CONDITION_OPERATORS.forEach(operator => {
      if (remaining.startsWith(operator) || remaining.startsWith(operator.toUpperCase())) {
        external[1] = operator;
      }
    });
  }
  // Validate value and convert to correct type
  if (external[0] && external[1] && !specialConditions.has(external[1])) {
    const strStart = `${external[0]} ${external[1]} `;

    // console.log("if internal starts with strstart ", internal.startsWith(strStart), 'strstart: ', strStart, ', internal: ', internal);
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
  console.log('EXTERNAL', external);
  return external;
}
