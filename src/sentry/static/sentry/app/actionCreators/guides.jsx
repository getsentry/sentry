import {Client} from '../api';
import GuideActions from '../actions/guideActions';

const api = new Client();

export function fetchGuides() {
  api.request('/assistant/', {
    method: 'GET',
    success: data => {
      GuideActions.fetchSuccess(data);
    },
  });
}
