import grammar from './grammar.pegjs';

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
  tokenTerm = (maybeFactor: term, remainingAdds: Array<Operation> | term) => {
    if (Array.isArray(remainingAdds) && remainingAdds.length > 0) {
      remainingAdds[0].lhs = maybeFactor;
      return flatten(remainingAdds);
    } else {
      return maybeFactor;
    }
  };

  tokenOperation = (operator: Operator, rhs: term): Operation => {
    return new Operation({operator, rhs});
  };

  tokenFactor = (primary: term, remaining: Array<Operation>): Operation | undefined => {
    remaining[0].lhs = primary;
    return flatten(remaining);
  };
}

function flatten(remaining: Array<Operation>): Operation | undefined {
  let term = remaining.shift();
  while (remaining.length > 0) {
    const nextTerm = remaining.shift();
    if (nextTerm && term && nextTerm.lhs === null) {
      nextTerm.lhs = term;
    }
    term = nextTerm;
  }
  return term;
}

const options = {
  TokenConverter,
};

export function parseArithmetic(query: string): Operation | null {
  try {
    return grammar.parse(query, options);
  } catch (e) {
    // TODO(wmak): Should we capture these errors somewhere?
  }

  return null;
}
