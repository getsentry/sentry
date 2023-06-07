import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {LocationDescriptor, LocationDescriptorObject} from 'history';

import {openModal} from 'sentry/actionCreators/modal';
import ContextPickerModal from 'sentry/components/contextPickerModal';

type Project = {
  id: string;
  slug: string;
};

type Props = {
  /**
   * Path used on the redirect router if the user did select a project
   */
  nextPath: Pick<LocationDescriptorObject, 'query'> & {
    pathname: NonNullable<LocationDescriptorObject['pathname']>;
  };
  /**
   * Path used on the redirect router if the user did not select a project
   */
  noProjectRedirectPath: LocationDescriptor;
  projects: Project[];
  router: InjectedRouter;
  allowAllProjectsSelection?: boolean;
};

function PickProjectToContinue({
  noProjectRedirectPath,
  nextPath,
  router,
  projects,
  allowAllProjectsSelection = false,
}: Props) {
  const nextPathQuery = nextPath.query;
  let navigating = false;
  let path = `${nextPath.pathname}?project=`;

  if (nextPathQuery) {
    const filteredQuery = Object.entries(nextPathQuery)
      .filter(([key, _value]) => key !== 'project')
      .map(([key, value]) => `${key}=${value}`);

    const newPathQuery = [...filteredQuery, 'project='].join('&');

    path = `${nextPath.pathname}?${newPathQuery}`;
  }

  // if the project in URL is missing, but this release belongs to only one project, redirect there
  if (projects.length === 1) {
    router.replace(path + projects[0].id);
    return null;
  }

  openModal(
    modalProps => (
      <ContextPickerModal
        {...modalProps}
        needOrg={false}
        needProject
        nextPath={`${path}:project`}
        onFinish={pathname => {
          navigating = true;
          router.replace(pathname);
        }}
        projectSlugs={projects.map(p => p.slug)}
        allowAllProjectsSelection={allowAllProjectsSelection}
      />
    ),
    {
      onClose() {
        // we want this to be executed only if the user didn't select any project
        // (closed modal either via button, Esc, clicking outside, ...)
        if (!navigating) {
          router.push(noProjectRedirectPath);
        }
      },
    }
  );

  return <ContextPickerBackground />;
}

const ContextPickerBackground = styled('div')`
  height: 100vh;
  width: 100%;
`;

export default PickProjectToContinue;
