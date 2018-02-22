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

export function nextStep() {
  GuideActions.nextStep();
}

export function closeGuide() {
  GuideActions.closeGuide();
}

export function markUseful(guideId, useful) {
  api.request('/assistant/', {
    method: 'PUT',
    data: {
      guide_id: guideId,
      status: 'viewed',
      useful,
    },
  });
}

export function dismiss(guideId) {
  api.request('/assistant/', {
    method: 'PUT',
    data: {
      guide_id: guideId,
      status: 'dismissed',
    },
  });
}
