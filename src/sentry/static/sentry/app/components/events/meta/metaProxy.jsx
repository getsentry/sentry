import isEmpty from 'lodash/isEmpty';
import isNull from 'lodash/isNull';

const GET_META = Symbol('GET_META');
const IS_PROXY = Symbol('IS_PROXY');

function isAnnotated(meta) {
  if (isEmpty(meta)) {
    return false;
  }
  return !isEmpty(meta.rem) || !isEmpty(meta.err);
}

export class MetaProxy {
  constructor(local) {
    this.local = local;
  }

  get(obj, prop, receiver) {
    // trap calls to `getMeta` to return meta object
    if (prop === GET_META) {
      return key => {
        if (this.local && this.local[key] && this.local[key]['']) {
          // TODO: Error checks
          const meta = this.local[key][''];

          return isAnnotated(meta) ? meta : null;
        }
        return null;
      };
    }

    // this is how  we can determine if current `obj` is a proxy
    if (prop === IS_PROXY) {
      return true;
    }

    const value = Reflect.get(obj, prop, receiver);
    if (!Reflect.has(obj, prop, receiver) || typeof value !== 'object' || isNull(value)) {
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

export function withMeta(event) {
  if (!event) {
    return null;
  }

  // Return unproxied `event` if browser does not support `Proxy`
  if (typeof window.Proxy === 'undefined' || typeof window.Reflect === 'undefined') {
    return event;
  }

  const _meta = event._meta;
  return new Proxy(event, new MetaProxy(_meta));
}

export function getMeta(obj, prop) {
  if (typeof obj[GET_META] !== 'function') {
    return null;
  }

  return obj[GET_META](prop);
}
