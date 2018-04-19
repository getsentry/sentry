import React from 'react';

import {openModal} from './modal';
import ContextPickerModal from '../components/contextPickerModal';

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
