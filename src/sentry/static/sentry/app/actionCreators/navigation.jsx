import React from 'react';
import get from 'lodash/get';

import {openModal} from 'app/actionCreators/modal';
import ContextPickerModal from 'app/components/contextPickerModal';
import NavigationActions from 'app/actions/navigationActions';

export function navigateTo(to, router) {
  // Check for placeholder params
  const needOrg = to.indexOf(':orgId') > -1;
  const needProject = to.indexOf(':projectId') > -1;
  const comingFromProjectId = get(router, 'location.query.project');

  if (needOrg || needProject) {
    openModal(
      ({closeModal, Header, Body}) => (
        <ContextPickerModal
          Header={Header}
          Body={Body}
          nextPath={to}
          needOrg={needOrg}
          needProject={needProject}
          comingFromProjectId={comingFromProjectId}
          onFinish={path => {
            closeModal();
            router.push(path);
          }}
        />
      ),
      {}
    );
  } else {
    router.push(to);
  }
}

export function setLastRoute(route) {
  NavigationActions.setLastRoute(route);
}
