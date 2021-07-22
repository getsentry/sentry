import {t} from 'app/locale';

import grammar from './grammar.pegjs';

const MAX_OPERATORS = 10;
const MAX_OPERATOR_MESSAGE = t('Maximum operators exceeded');

type OperationOpts = {
  operator: Operator;
  lhs?: term;
  rhs: term;
};

type Operator = 'plus' | 'minus' | 'multiply' | 'divide';
type term = Operation | string | number | null;
export class Operation {
  operator: Operator;
  lhs?: term;
  rhs: term;

  constructor({operator, lhs = null, rhs}: OperationOpts) {
    this.operator = operator;
    this.lhs = lhs;
    this.rhs = rhs;
  }
}

export class TokenConverter {
  numOperations: number;
  errors: Array<string>;

  constructor() {
    this.numOperations = 0;
    this.errors = [];
  }

  tokenTerm = (maybeFactor: term, remainingAdds: Array<Operation>): term => {
    if (remainingAdds.length > 0) {
      remainingAdds[0].lhs = maybeFactor;
      return flatten(remainingAdds);
    } else {
      return maybeFactor;
    }
  };

  tokenOperation = (operator: Operator, rhs: term): Operation => {
    this.numOperations += 1;
    if (
      this.numOperations > MAX_OPERATORS &&
      !this.errors.includes(MAX_OPERATOR_MESSAGE)
    ) {
      this.errors.push(MAX_OPERATOR_MESSAGE);
    }
    if (operator === 'divide' && rhs === '0') {
      this.errors.push(t('Division by 0 is not allowed'));
    }
    return new Operation({operator, rhs});
  };

  tokenFactor = (primary: term, remaining: Array<Operation>): Operation | undefined => {
    remaining[0].lhs = primary;
    return flatten(remaining);
  };
}

function flatten(remaining: Array<Operation>): Operation {
  let term = remaining.shift();
  while (remaining.length > 0) {
    const nextTerm = remaining.shift();
    if (nextTerm && term && nextTerm.lhs === null) {
      nextTerm.lhs = term;
    }
    term = nextTerm;
  }
  // Shouldn't happen, tokenTerm checks remaining and tokenFactor should have at least 1 item
  // This is just to help ts out
  if (term === undefined) {
    throw new Error('Unable to parse arithmetic');
  }
  return term;
}

export function parseArithmetic(query: string): {result: term; error: string} {
  const tc = new TokenConverter();
  try {
    const result = grammar.parse(query, {tc});
    return {result, error: tc.errors[0]};
  } catch (error) {
    return {result: null, error: error.message};
  }
}
