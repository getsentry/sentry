import _ from 'lodash';

class Annotated {
  constructor(value, meta) {
    this.value = value;
    this.meta = meta;
  }

  get(...path) {
    let value = this.value;
    let meta = this.meta;

    while (_.isObject(value) && path.length) {
      let key = path.shift();
      value = value[key];
      if (_.isObject(meta)) {
        meta = meta[key] || null;
      }
    }

    return path.length === 0
      ? new Annotated(value, meta)
      : new Annotated(undefined, null);
  }

  annotated() {
    let meta = this.meta && this.meta[''];
    if (_.isEmpty(meta)) return false;
    return !_.isEmpty(meta.rem) || !_.isEmpty(meta.err);
  }
}

export default Annotated;
