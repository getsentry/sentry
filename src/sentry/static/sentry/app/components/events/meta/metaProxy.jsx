import _ from 'lodash';

const GET_META = Symbol('GET_META');

function isAnnotated(meta) {
  if (_.isEmpty(meta)) return false;
  return !_.isEmpty(meta.rem) || !_.isEmpty(meta.err);
}

export class MetaProxy {
  constructor(root, local) {
    // entire meta object
    this._meta = root;

    this.local = !local ? root : local;
  }

  get(obj, prop) {
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

    if (
      !obj.hasOwnProperty(prop) ||
      typeof obj[prop] !== 'object' ||
      _.isNull(obj[prop])
    ) {
      return obj[prop];
    }

    // Make sure we apply proxy to all children (objects and arrays)
    // Do we need to check for annotated inside of objects?
    return new Proxy(
      obj[prop],
      new MetaProxy(this._meta, this.local && this.local[prop])
    );
  }
}

export function decorateEvent(event) {
  let _meta = event._meta;

  return new Proxy(event, new MetaProxy(_meta));
}

export function getMeta(obj, prop) {
  if (typeof obj[GET_META] !== 'function') return null;
  return obj[GET_META](prop);
}
