import React from 'react';
import * as ReactRouter from 'react-router';
import styled from '@emotion/styled';

import {openModal} from 'app/actionCreators/modal';
import ContextPickerModalContainer from 'app/components/contextPickerModal';
import {ReleaseProject} from 'app/types';

type Props = {
  orgSlug: string;
  version: string;
  router: ReactRouter.InjectedRouter;
  projects: ReleaseProject[];
};

const PickProjectToContinue = ({orgSlug, version, router, projects}: Props) => {
  const path = `/organizations/${orgSlug}/releases-v2/${encodeURIComponent(
    version
  )}/?project=`;

  // if the project in URL is missing, but this release belongs to only one project, redirect there
  if (projects.length === 1) {
    router.replace(path + projects[0].id);
    return null;
  }

  openModal(
    ({Header, Body}) => (
      <ContextPickerModalContainer
        Header={Header}
        Body={Body}
        needOrg={false}
        needProject
        nextPath={`${path}:project`}
        onFinish={pathname => {
          router.replace(pathname);
        }}
        projectSlugs={projects.map(p => p.slug)}
      />
    ),
    {
      onClose() {
        // if a user closes the modal (either via button, Ecs, clicking outside)
        router.push(`/organizations/${orgSlug}/releases-v2/`);
      },
    }
  );

  return <ContextPickerBackground />;
};

const ContextPickerBackground = styled('div')`
  height: 100vh;
  width: 100%;
`;

export default PickProjectToContinue;
