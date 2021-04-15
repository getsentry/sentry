import isEmpty from 'lodash/isEmpty';
import isNull from 'lodash/isNull';

import {Meta} from 'app/types';

const GET_META = Symbol('GET_META');
const IS_PROXY = Symbol('IS_PROXY');

function isAnnotated(meta) {
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

  get<T extends {}>(obj: T | Array<T>, prop: Extract<keyof T, string>, receiver: T) {
    // trap calls to `getMeta` to return meta object
    if (prop === GET_META) {
      return key => {
        if (this.local && this.local[key] && this.local[key]['']) {
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
    if (!Reflect.has(obj, prop) || typeof value !== 'object' || isNull(value)) {
      return value;
    }

    // This is so we don't create a new Proxy from an object that is
    // already a proxy. Otherwise we can get into very deep recursive calls
    if (Reflect.get(obj, IS_PROXY, receiver)) {
      return value;
    }

    // Make sure we apply proxy to all children (objects and arrays)
    // Do we need to check for annotated inside of objects?
    return new Proxy(value, new MetaProxy(this.local && this.local[prop]));
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

export function getMeta<T extends {}>(
  obj: T | undefined,
  prop: Extract<keyof T, string>
): Meta | undefined {
  if (!obj || typeof obj[GET_META] !== 'function') {
    return undefined;
  }

  return obj[GET_META](prop);
}
