import React from 'react';
import {InjectedRouter} from 'react-router/lib/Router';

import {openModal} from 'app/actionCreators/modal';
import ContextPickerModal from 'app/components/contextPickerModal';
import NavigationActions from 'app/actions/navigationActions';

export function navigateTo(to: string, router: InjectedRouter) {
  // Check for placeholder params
  const needOrg = to.indexOf(':orgId') > -1;
  const needProject = to.indexOf(':projectId') > -1;

  if (needOrg || needProject) {
    openModal(
      ({closeModal, Header, Body}) => (
        <ContextPickerModal
          Header={Header}
          Body={Body}
          nextPath={to}
          needOrg={needOrg}
          needProject={needProject}
          onFinish={path => {
            closeModal();
            setTimeout(() => router.push(path), 0);
          }}
        />
      ),
      {}
    );
  } else {
    router.push(to);
  }
}

export function setLastRoute(route: string) {
  NavigationActions.setLastRoute(route);
}
