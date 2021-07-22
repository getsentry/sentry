import {t} from 'app/locale';

import grammar from './grammar.pegjs';

// This constant should stay in sync with the backend parser
const MAX_OPERATORS = 10;
const MAX_OPERATOR_MESSAGE = t('Maximum operators exceeded');

type OperationOpts = {
  operator: Operator;
  lhs?: Term;
  rhs: Term;
};

type Operator = 'plus' | 'minus' | 'multiply' | 'divide';
type Term = Operation | string | number | null;
export class Operation {
  operator: Operator;
  lhs?: Term;
  rhs: Term;

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

  tokenTerm = (maybeFactor: Term, remainingAdds: Array<Operation>): Term => {
    if (remainingAdds.length > 0) {
      remainingAdds[0].lhs = maybeFactor;
      return flatten(remainingAdds);
    } else {
      return maybeFactor;
    }
  };

  tokenOperation = (operator: Operator, rhs: Term): Operation => {
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

  tokenFactor = (primary: Term, remaining: Array<Operation>): Operation | undefined => {
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

export function parseArithmetic(query: string): {result: Term; error: string} {
  const tc = new TokenConverter();
  try {
    const result = grammar.parse(query, {tc});
    return {result, error: tc.errors[0]};
  } catch (error) {
    return {result: null, error: error.message};
  }
}
