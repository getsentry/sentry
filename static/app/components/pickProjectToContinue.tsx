import {useEffect, useRef} from 'react';
import type {LocationDescriptor, LocationDescriptorObject} from 'history';

import {Container} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';

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
  const {openModal} = useModal();
  const navigate = useNavigate();
  const nextPathQuery = nextPath.query;
  const navigating = useRef(false);

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

  useEffect(() => {
    if (shouldRedirect) {
      return;
    }
    navigating.current = false;
    openModal(
      modalProps => (
        <ContextPickerModal
          {...modalProps}
          needOrg={false}
          needProject
          nextPath={`${path}:project`}
          onFinish={to => {
            navigating.current = true;
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
          if (!navigating.current) {
            navigate(noProjectRedirectPath);
          }
        },
      }
    );
  }, [
    shouldRedirect,
    openModal,
    navigate,
    noProjectRedirectPath,
    path,
    projects,
    allowAllProjectsSelection,
  ]);

  if (shouldRedirect) {
    return null;
  }

  return <Container width="100%" height="100vh" />;
}
