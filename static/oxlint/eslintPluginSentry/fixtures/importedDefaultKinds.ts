export function text(value = 'all') {
  return value;
}

export function template(value = `all`) {
  return value;
}

export function negative(value = -1) {
  return value;
}

export function positive(value = +1) {
  return value;
}

export function big(value = 1_0n) {
  return value;
}

export function negativeBig(value = -10n) {
  return value;
}

export function bitwiseNot(value = ~1) {
  return value;
}

export function bitwiseNotBig(value = ~1n) {
  return value;
}

export function enabled(value = true) {
  return value;
}

export function disabled(value = false) {
  return value;
}

export function empty(value: string | null = null) {
  return value;
}

export function wrapped(value = 5 satisfies number as number) {
  return value;
}

export function angleAsserted(value = <number>5) {
  return value;
}

export function nonNull(value = 5!) {
  return value;
}

export function notHardcoded(value = Number.MAX_SAFE_INTEGER) {
  return value;
}

export function withThis(this: unknown, first = 0, second = 1) {
  return [this, first, second];
}

export function withKeys({
  'quoted-key': quoted = 1,
  2: numeric = 2,
  ...rest
}: {
  'quoted-key'?: number;
  2?: number;
  other?: number;
}) {
  return [quoted, numeric, rest];
}

export function withDefaultedOptions({value = 5}: {value?: number} = {}) {
  return value;
}

export type MergedName = number;

export function MergedName(value = 11) {
  return value;
}

export function overloaded(value?: number): number;
export function overloaded(value = 3) {
  return value;
}

export const arrow = (value = 4) => value,
  expression = function (value = 5) {
    return value;
  };

export const asserted = ((value = 6) => value) as (value?: number) => number;

export const notFunction = 7;

export declare const declared: (value?: number) => number;

function local(value = 8) {
  return value;
}

function shadowed(value = 9) {
  return value;
}

const shadowedConst = (value = 14) => value;

export const usesShadowed = [shadowed, shadowedConst];

type LocalMerged = number;

function LocalMerged(value = 12) {
  return value;
}

function localOverloaded(value?: number): number;
function localOverloaded(value = 10) {
  return value;
}

export {
  local as renamedLocal,
  local as shadowed,
  local as shadowedConst,
  LocalMerged as localMerged,
  localOverloaded,
};

export * from './defaultFunction';

export * as namespace from './importedDefault';
