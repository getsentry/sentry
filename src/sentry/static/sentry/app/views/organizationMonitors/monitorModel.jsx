import FormModel from 'app/views/settings/components/forms/model';

export default class MonitorModel extends FormModel {
  getTransformedData() {
    return Object.entries(this.fields.toJSON()).reduce((data, [k, v]) => {
      if (k.indexOf('config.') === 0) {
        if (!data.config) data.config = {};
        data.config[k.substr(7)] = v;
      } else {
        data[k] = v;
      }
      return data;
    }, {});
  }

  getTransformedValue(id) {
    if (id.indexOf('config') === 0) return this.getValue(id);
    return super.getTransformedValue(id);
  }
}
