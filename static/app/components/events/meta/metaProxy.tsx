import isEmpty from 'lodash/isEmpty';

import type {Meta} from 'sentry/types/group';

const GET_META = Symbol('GET_META');
const IS_PROXY = Symbol('IS_PROXY');

type SymbolProp = typeof GET_META | typeof IS_PROXY;

function isAnnotated(meta: any) {
  if (isEmpty(meta)) {
    return false;
  }
  return !isEmpty(meta.rem) || !isEmpty(meta.err);
}

type Local = Record<string, any> | undefined;

export class MetaProxy {
  private local: Local;

  constructor(local: Local) {
    this.local = local;
  }

  get<T extends Record<string, unknown>>(
    obj: T | T[],
    prop: Extract<keyof T, string> | SymbolProp,
    receiver: T
  ): any {
    // trap calls to `getMeta` to return meta object
    if (prop === GET_META) {
      return (key: any) => {
        if (this.local?.[key]?.['']) {
          // TODO: Error checks
          const meta = this.local[key][''];

          return isAnnotated(meta) ? meta : undefined;
        }
        return undefined;
      };
    }

    // this is how  we can determine if current `obj` is a proxy
    if (prop === IS_PROXY) {
      return true;
    }

    const value = Reflect.get(obj, prop, receiver);
    if (!Reflect.has(obj, prop) || typeof value !== 'object' || value === null) {
      return value;
    }

    // This is so we don't create a new Proxy from an object that is
    // already a proxy. Otherwise we can get into very deep recursive calls
    if (Reflect.get(obj, IS_PROXY, receiver)) {
      return value;
    }

    // Make sure we apply proxy to all children (objects and arrays)
    // Do we need to check for annotated inside of objects?
    return new Proxy(value, new MetaProxy(this.local?.[prop]));
  }
}

export function withMeta<T>(event: T): T {
  if (!event) {
    return event;
  }

  // Return unproxied `event` if browser does not support `Proxy`
  if (typeof window.Proxy === 'undefined' || typeof window.Reflect === 'undefined') {
    return event;
  }

  // withMeta returns a type that is supposed to be 100% compatible with its
  // input type. Proxy typing on typescript is not really functional enough to
  // make this work without casting.
  //
  // https://github.com/microsoft/TypeScript/issues/20846
  return new Proxy(event, new MetaProxy((event as any)._meta)) as T;
}

export function getMeta<T extends Record<string, unknown>>(
  obj: T | undefined,
  prop: Extract<keyof T, string>
): Meta | undefined {
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  if (!obj || typeof obj[GET_META] !== 'function') {
    return undefined;
  }

  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return obj[GET_META](prop);
}
