import {Client} from '../api';

const initialState = {
  client: new Client(),
};

function api(state = initialState) {
  return state;
}

export default api;
