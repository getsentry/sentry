import {combineReducers} from 'redux';
import api from './api';
import environment from './environment';
import organization from './organization';
import latestContext from './latestContext';

const rootReducer = combineReducers({
  api,
  environment,
  organization,
  latestContext,
});

export default rootReducer;
