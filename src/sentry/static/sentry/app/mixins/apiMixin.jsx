import {Client} from 'app/api';

const ApiMixin = {
  componentWillMount() {
    this.api = new Client();
  },

  componentWillUnmount() {
    this.api.clear();
  },
};

export default ApiMixin;
