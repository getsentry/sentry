import React from 'react';

import {openModal} from 'app/actionCreators/modal';
import ContextPickerModal from 'app/components/contextPickerModal';
import NavigationActions from 'app/actions/navigationActions';

export function navigateTo(to, router) {
  // Check for placeholder params
  let needOrg = to.indexOf(':orgId') > -1;
  let needProject = to.indexOf(':projectId') > -1;

  if (needOrg || needProject) {
    openModal(({closeModal, Header, Body}) => (
      <ContextPickerModal
        Header={Header}
        Body={Body}
        nextPath={to}
        needOrg={needOrg}
        needProject={needProject}
        onFinish={path => {
          closeModal();
          router.push(path);
        }}
      />
    ));
  } else {
    router.push(to);
  }
}

export function setLastRoute(route) {
  NavigationActions.setLastRoute(route);
}
