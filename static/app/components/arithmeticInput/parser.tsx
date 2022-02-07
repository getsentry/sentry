import {LocationRange} from 'pegjs';

import {t} from 'sentry/locale';

import grammar from './grammar.pegjs';

// This constant should stay in sync with the backend parser
const MAX_OPERATORS = 10;
const MAX_OPERATOR_MESSAGE = t('Maximum operators exceeded');

type OperationOpts = {
  operator: Operator;
  rhs: Expression;
  lhs?: Expression;
};

type Operator = 'plus' | 'minus' | 'multiply' | 'divide';
type Expression = Operation | string | number | null;

export class Operation {
  operator: Operator;
  lhs?: Expression;
  rhs: Expression;

  constructor({operator, lhs = null, rhs}: OperationOpts) {
    this.operator = operator;
    this.lhs = lhs;
    this.rhs = rhs;
  }
}

class Term {
  term: Expression;
  location: LocationRange;

  constructor({term, location}: {location: LocationRange; term: Expression}) {
    this.term = term;
    this.location = location;
  }
}

export class TokenConverter {
  numOperations: number;
  errors: Array<string>;
  fields: Array<Term>;
  functions: Array<Term>;

  constructor() {
    this.numOperations = 0;
    this.errors = [];
    this.fields = [];
    this.functions = [];
  }

  tokenTerm = (maybeFactor: Expression, remainingAdds: Array<Operation>): Expression => {
    if (remainingAdds.length > 0) {
      remainingAdds[0].lhs = maybeFactor;
      return flatten(remainingAdds);
    }
    return maybeFactor;
  };

  tokenOperation = (operator: Operator, rhs: Expression): Operation => {
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

  tokenFactor = (primary: Expression, remaining: Array<Operation>): Operation => {
    remaining[0].lhs = primary;
    return flatten(remaining);
  };

  tokenField = (term: Expression, location: LocationRange): Expression => {
    const field = new Term({term, location});
    this.fields.push(field);
    return term;
  };

  tokenFunction = (term: Expression, location: LocationRange): Expression => {
    const func = new Term({term, location});
    this.functions.push(func);
    return term;
  };
}

// Assumes an array with at least one element
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

type parseResult = {
  error: string | undefined;
  result: Expression;
  tc: TokenConverter;
};

export function parseArithmetic(query: string): parseResult {
  const tc = new TokenConverter();
  try {
    const result = grammar.parse(query, {tc});
    return {result, error: tc.errors[0], tc};
  } catch (error) {
    return {result: null, error: error.message, tc};
  }
}
