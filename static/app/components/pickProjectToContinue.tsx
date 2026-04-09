import {useEffect} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor, LocationDescriptorObject} from 'history';

import {openModal} from 'sentry/actionCreators/modal';
import {ContextPickerModalContainer as ContextPickerModal} from 'sentry/components/contextPickerModal';
import {useNavigate} from 'sentry/utils/useNavigate';

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
  allowAllProjectsSelection?: boolean;
};

export function PickProjectToContinue({
  noProjectRedirectPath,
  nextPath,
  projects,
  allowAllProjectsSelection = false,
}: Props) {
  const navigate = useNavigate();
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
  const shouldRedirect = projects.length === 1;
  useEffect(() => {
    if (shouldRedirect) {
      navigate(path + projects[0]!.id, {replace: true});
    }
  }, [shouldRedirect, navigate, path, projects]);

  if (shouldRedirect) {
    return null;
  }

  openModal(
    modalProps => (
      <ContextPickerModal
        {...modalProps}
        needOrg={false}
        needProject
        nextPath={`${path}:project`}
        onFinish={to => {
          navigating = true;
          navigate(to, {replace: true});
          modalProps.closeModal();
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
          navigate(noProjectRedirectPath);
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
