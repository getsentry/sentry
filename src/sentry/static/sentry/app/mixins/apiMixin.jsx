import {Client} from '../api';

let ApiMixin = {
  componentWillMount() {
    this.api = new Client();
  },

  componentWillUnmount() {
    this.api.clear();
  }
};

export default ApiMixin;
