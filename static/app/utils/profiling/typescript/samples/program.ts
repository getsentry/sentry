// yarn run tsc static/app/utils/profiling/typescript/samples/program.ts --generateTrace static/app/utils/profiling/typescript/samples/tsc_trace --incremental false --diagnostics --skipLibCheck

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

type IndexedType = [number, string, Array<any>];
type CustomRecord = {
  arr: [];
  object: {};
};

type MappedType = {
  readonly [K in keyof CustomRecord]: CustomRecord[K];
};

export const a: CustomNumber | CustomString = 0;
export const indexedType0: IndexedType[1] = 'test';
export const indexedType1: IndexedType[0] = 0;
export const mappedType: MappedType | IndexedType = {
  arr: [],
  object: {},
};

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
