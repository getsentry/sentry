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
  let navigating = false;

  const path = `/organizations/${orgSlug}/releases/${encodeURIComponent(
    version
  )}/?project=`;

  // if the project in URL is missing, but this release belongs to only one project, redirect there
  if (projects.length === 1) {
    router.replace(path + projects[0].id);
    return null;
  }

  openModal(
    modalProps => (
      <ContextPickerModalContainer
        {...modalProps}
        needOrg={false}
        needProject
        nextPath={`${path}:project`}
        onFinish={pathname => {
          navigating = true;
          router.replace(pathname);
        }}
        projectSlugs={projects.map(p => p.slug)}
      />
    ),
    {
      onClose() {
        // we want this to be executed only if the user didn't select any project
        // (closed modal either via button, Esc, clicking outside, ...)
        if (!navigating) {
          router.push(`/organizations/${orgSlug}/releases/`);
        }
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
