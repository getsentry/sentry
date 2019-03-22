import FormModel from 'app/views/settings/components/forms/model';

export default class MonitorModel extends FormModel {
  getTransformedData() {
    return Object.entries(this.fields.toJSON()).reduce((data, [k, v]) => {
      if (k.indexOf('config.') === 0) {
        if (!data.config) {
          data.config = {};
        }
        if (k === 'config.schedule.frequency' || k === 'config.schedule.interval') {
          if (!Array.isArray(data.config.schedule)) {
            data.config.schedule = [null, null];
          }
        }

        if (k === 'config.schedule.frequency') {
          data.config.schedule[0] = parseInt(v, 10);
        } else if (k === 'config.schedule.interval') {
          data.config.schedule[1] = v;
        } else {
          data.config[k.substr(7)] = v;
        }
      } else {
        data[k] = v;
      }
      return data;
    }, {});
  }

  getTransformedValue(id) {
    if (id.indexOf('config') === 0) {
      return this.getValue(id);
    }
    return super.getTransformedValue(id);
  }
}
