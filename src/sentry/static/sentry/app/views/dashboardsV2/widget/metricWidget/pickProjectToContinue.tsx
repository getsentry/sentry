import React from 'react';
import * as ReactRouter from 'react-router';
import styled from '@emotion/styled';

import {openModal} from 'app/actionCreators/modal';
import ContextPickerModal from 'app/components/contextPickerModal';
import {Organization, Project} from 'app/types';

type Props = {
  orgSlug: Organization['slug'];
  router: ReactRouter.InjectedRouter;
  projects: Project[];
};

const PickProjectToContinue = ({orgSlug, router, projects}: Props) => {
  // if the project is already selected, skip modal
  if (projects.length === 1) {
    return null;
  }

  openModal(modalProps => (
    <ContextPickerModal
      {...modalProps}
      needOrg={false}
      needProject
      nextPath={`/organizations/${orgSlug}/dashboards/widget/new/?dataSet=metrics&project=:project`}
      onFinish={pathname => {
        modalProps.closeModal();
        router.replace(pathname);
      }}
      projectSlugs={projects.map(p => p.slug)}
    />
  ));

  return <ContextPickerBackground />;
};

const ContextPickerBackground = styled('div')`
  height: 100vh;
  width: 100%;
`;

export default PickProjectToContinue;
