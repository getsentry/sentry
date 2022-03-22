// yarn run tsc static/app/utils/profiling/typescript/samples/program.ts --generateTrace static/app/utils/profiling/typescript/samples/tsc_trace --incremental false --diagnostics --skipLibCheck --noEmit

type CustomNumber = number;
type CustomString = string;

type A = B;
type B = C | D;
type C = E | void;
type D = {};
type E = number;

interface BaseIndustries {
  import: () => Promise<any>;
}

interface VandelayIndustries extends BaseIndustries {
  export?: () => Promise<any>;
}

interface NeverIndustries {
  export?: () => Promise<any>;
}

type Union = VandelayIndustries | NeverIndustries;
type Intersection = NeverIndustries & VandelayIndustries;

type RecursiveType<T> = {
  type?: RecursiveType<T>;
};

type SimpleTuple = [number, string, Array<any>];

type CustomRecord = {
  arr: [];
  object: {};
};

type MappedType = {
  readonly [K in keyof CustomRecord]: CustomRecord[K];
};
type ComplexTuple = [number | string, CustomRecord | never];

export const a: CustomNumber | CustomString = 0;
export const indexedType0: SimpleTuple[1] = 'test';
export const indexedType1: SimpleTuple[0] = 0;
export const mappedType: MappedType | SimpleTuple = {
  arr: [],
  object: {},
};

export const tuple: ComplexTuple = [0, {arr: [], object: {}}];

function tupleCheck(t: ComplexTuple | MappedType) {
  return t[0];
}

tupleCheck(tuple);

export const aa: A = void 0;
export const b: RecursiveType<string> = {
  type: {
    type: {},
  },
};
export const c: Union = {
  import: () => Promise.resolve(),
};
export const d: Intersection = {
  import: () => Promise.resolve(),
  export: () => Promise.resolve(),
};
