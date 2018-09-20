export default class Meta {
  constructor(data) {
    this.data = data;
  }

  _get(...path) {
    let meta = this.data;
    while (meta && path.length) {
      meta = meta[String(path.shift())];
    }
    return meta;
  }

  get(...path) {
    let meta = this._get(...path);
    return meta && meta[''];
  }

  in(...path) {
    return new Meta(this._get(...path));
  }
}
