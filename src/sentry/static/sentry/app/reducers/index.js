import {combineReducers} from 'redux';
import api from './api';
import environment from './environment';

const rootReducer = combineReducers({
  api,
  environment,
});

export default rootReducer;
