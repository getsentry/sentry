import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {openModal} from 'sentry/actionCreators/modal';
import ContextPickerModal from 'sentry/components/contextPickerModal';
import {useNavigate} from 'sentry/utils/useNavigate';

type Project = {
  id: string;
  slug: string;
};

type Props = {
  /**
   * Path used on the redirect router if the user did select a project
   */
  nextPath: LocationDescriptor;
  /**
   * Path used on the redirect router if the user did not select a project
   */
  noProjectRedirectPath: LocationDescriptor;
  projects: Project[];
  allowAllProjectsSelection?: boolean;
};

function PickProjectToContinue({
  noProjectRedirectPath,
  nextPath,
  projects,
  allowAllProjectsSelection = false,
}: Props) {
  const navigating = useRef(false);
  const navigate = useNavigate();
  const nextPathQuery = typeof nextPath === 'string' ? {} : nextPath.query;
  let path = `${typeof nextPath === 'string' ? nextPath : nextPath.pathname}?project=`;

  if (nextPathQuery) {
    const filteredQuery = Object.entries(nextPathQuery)
      .filter(([key, _value]) => key !== 'project')
      .map(([key, value]) => `${key}=${value}`);

    const newPathQuery = [...filteredQuery, 'project='].join('&');

    path = `${typeof nextPath === 'string' ? nextPath : nextPath.pathname}?${newPathQuery}`;
  }

  useEffect(() => {
    if (projects.length === 1) {
      return;
    }

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
          }}
          projectSlugs={projects.map(p => p.slug)}
          allowAllProjectsSelection={allowAllProjectsSelection}
        />
      ),
      {
        onClose() {
          // this callback is fired when the user selects a project, or not. we
          // want this to be executed only if the user didn't select any
          // project (closed modal either via button, Esc, clicking outside,
          // ...)
          if (!navigating.current) {
            navigate(noProjectRedirectPath);
            navigating.current = false;
          }
        },
      }
    );
    // We only ever want to call `openModal` once. As long as `projects.length`
    // is > 1, we should open the modal. We rely on the user selecting a project
    // and `<GlobalModal>` will close the modal when `location.pathname` changes.
    //
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // if the project in URL is missing, but this release belongs to only one project, redirect there
  if (projects.length === 1) {
    navigate(path + projects[0]!.id, {replace: true});
    return null;
  }

  return <ContextPickerBackground />;
}

const ContextPickerBackground = styled('div')`
  height: 100vh;
  width: 100%;
`;

export default PickProjectToContinue;
