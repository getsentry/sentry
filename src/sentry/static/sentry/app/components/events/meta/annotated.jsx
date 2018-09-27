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
        meta = meta[key];
      }
    }

    return new Annotated(value, meta);
  }

  annotated() {
    let meta = this.meta && this.meta[''];
    if (_.isEmpty(meta)) return false;
    return !_.isEmpty(meta.rem) || !_.isEmpty(meta.err);
  }
}

export default Annotated;
