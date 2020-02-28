// from:
// - https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#assertion-functions
// - https://www.typescriptlang.org/play/#example/assertion-functions

// This declares a function which asserts that the expression called
// value is true:
// eslint-disable-next-line prettier/prettier
export function assert(_value: unknown): asserts _value {}

// This declares a function which asserts that the expression called
// value is of type Type:
// eslint-disable-next-line prettier/prettier
export function assertType<Type>(_value: unknown): asserts _value is Type {}
