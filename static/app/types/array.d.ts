// ts-reset–style narrowing for `Array.prototype.filter(Boolean)`.
type Falsy = false | null | undefined | 0 | '' | 0n;

interface Array<T> {
  filter<S extends T>(
    predicate: BooleanConstructor,
    thisArg?: any
  ): Array<Exclude<S, Falsy>>;
}

interface ReadonlyArray<T> {
  filter<S extends T>(
    predicate: BooleanConstructor,
    thisArg?: any
  ): Array<Exclude<S, Falsy>>;
}
