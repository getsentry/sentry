// https://github.com/microsoft/typescript-analyze-trace/blob/9e2c745ea424911d364b0c8d37998d77e8373049/src/simplify-type.ts

type TypeFlag =
  | 'Any'
  | 'Unknown'
  | 'String'
  | 'Number'
  | 'Boolean'
  | 'Enum'
  | 'BigInt'
  | 'StringLiteral'
  | 'NumberLiteral'
  | 'BooleanLiteral'
  | 'EnumLiteral'
  | 'BigIntLiteral'
  | 'ESSymbol'
  | 'UniqueESSymbol'
  | 'Void'
  | 'Undefined'
  | 'Null'
  | 'Never'
  | 'TypeParameter'
  | 'Object'
  | 'Union'
  | 'Intersection'
  | 'Index'
  | 'IndexedAccess'
  | 'Conditional'
  | 'Substitution'
  | 'NonPrimitive'
  | 'TemplateLiteral'
  | 'StringMapping';

function expandTypeFlags41(flags41: number): TypeFlag[] {
  const flags: TypeFlag[] = [];

  if (flags41 & (1 << 0)) {
    flags.push('Any');
  }
  if (flags41 & (1 << 1)) {
    flags.push('Unknown');
  }
  if (flags41 & (1 << 2)) {
    flags.push('String');
  }
  if (flags41 & (1 << 3)) {
    flags.push('Number');
  }
  if (flags41 & (1 << 4)) {
    flags.push('Boolean');
  }
  if (flags41 & (1 << 5)) {
    flags.push('Enum');
  }
  if (flags41 & (1 << 6)) {
    flags.push('BigInt');
  }
  if (flags41 & (1 << 7)) {
    flags.push('StringLiteral');
  }
  if (flags41 & (1 << 8)) {
    flags.push('NumberLiteral');
  }
  if (flags41 & (1 << 9)) {
    flags.push('BooleanLiteral');
  }
  if (flags41 & (1 << 10)) {
    flags.push('EnumLiteral');
  }
  if (flags41 & (1 << 11)) {
    flags.push('BigIntLiteral');
  }
  if (flags41 & (1 << 12)) {
    flags.push('ESSymbol');
  }
  if (flags41 & (1 << 13)) {
    flags.push('UniqueESSymbol');
  }
  if (flags41 & (1 << 14)) {
    flags.push('Void');
  }
  if (flags41 & (1 << 15)) {
    flags.push('Undefined');
  }
  if (flags41 & (1 << 16)) {
    flags.push('Null');
  }
  if (flags41 & (1 << 17)) {
    flags.push('Never');
  }
  if (flags41 & (1 << 18)) {
    flags.push('TypeParameter');
  }
  if (flags41 & (1 << 19)) {
    flags.push('Object');
  }
  if (flags41 & (1 << 20)) {
    flags.push('Union');
  }
  if (flags41 & (1 << 21)) {
    flags.push('Intersection');
  }
  if (flags41 & (1 << 22)) {
    flags.push('Index');
  }
  if (flags41 & (1 << 23)) {
    flags.push('IndexedAccess');
  }
  if (flags41 & (1 << 24)) {
    flags.push('Conditional');
  }
  if (flags41 & (1 << 25)) {
    flags.push('Substitution');
  }
  if (flags41 & (1 << 26)) {
    flags.push('NonPrimitive');
  }
  if (flags41 & (1 << 27)) {
    flags.push('TemplateLiteral');
  }
  if (flags41 & (1 << 28)) {
    flags.push('StringMapping');
  }

  return flags;
}

function getTypeFlags(flags: readonly string[]): readonly TypeFlag[] {
  // Traces from TS 4.1 contained numeric flags, rather than their string equivalents
  return flags.length === 1 && /^\d+$/.test(flags[0])
    ? expandTypeFlags41(+flags[0])
    : (flags as TypeFlag[]);
}

export function isTypeScriptTypesJSONFile(
  input: any
): input is TypeScriptTypes.TypeDescriptor[] {
  return Array.isArray(input) && typeof input[0]?.id === 'number';
}

export function importTypeScriptTypesJSONFile(
  input: TypeScriptTypes.TypeDescriptor[]
): TypeScriptTypes.TypeTree {
  const tree: TypeScriptTypes.TypeTree = {};

  while (input.length > 0) {
    const type = input.pop();

    if (!type) {
      throw new Error('Empty type queue');
    }

    tree[type.id] = {
      flags: getTypeFlags(type.flags ?? []),
      node: type,
    };
  }

  return tree;
}
