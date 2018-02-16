import {Client} from '../api';
import GuideActions from '../actions/guideActions';

const api = new Client();

export function fetchGuides() {
  api.request('/assistant/', {
    method: 'GET',
    success: data => {
      GuideActions.fetchSucceeded(data);
    },
  });
}

export function registerAnchor(anchor) {
  GuideActions.registerAnchor(anchor);
}

export function unregisterAnchor(anchor) {
  GuideActions.unregisterAnchor(anchor);
}
