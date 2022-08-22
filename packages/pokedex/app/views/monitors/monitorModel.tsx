import FormModel from 'sentry/components/forms/model';

import {MonitorConfig} from './types';

type TransformedData = {
  config?: Partial<MonitorConfig>;
};

export default class MonitorModel extends FormModel {
  getTransformedData() {
    return this.fields.toJSON().reduce<TransformedData>((data, [k, v]) => {
      if (k.indexOf('config.') !== 0) {
        data[k] = v;
        return data;
      }

      if (!data.config) {
        data.config = {};
      }
      if (k === 'config.schedule.frequency' || k === 'config.schedule.interval') {
        if (!Array.isArray(data.config.schedule)) {
          data.config.schedule = [null, null];
        }
      }

      if (k === 'config.schedule.frequency') {
        data.config!.schedule![0] = parseInt(v as string, 10);
      } else if (k === 'config.schedule.interval') {
        data.config!.schedule![1] = v;
      } else {
        data.config[k.substr(7)] = v;
      }

      return data;
    }, {});
  }

  getTransformedValue(id: string) {
    return id.indexOf('config') === 0 ? this.getValue(id) : super.getTransformedValue(id);
  }
}
