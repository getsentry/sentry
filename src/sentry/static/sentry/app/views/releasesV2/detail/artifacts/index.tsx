import React from 'react';
import styled from '@emotion/styled';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';

import {t} from 'app/locale';
import {GlobalSelection} from 'app/types';
import Alert from 'app/components/alert';
import space from 'app/styles/space';
import ReleaseArtifactsV1 from 'app/views/releases/detail/releaseArtifacts';
import withGlobalSelection from 'app/utils/withGlobalSelection';

import {ReleaseContext} from '..';

type Props = {
  params: Params;
  location: Location;
  selection: GlobalSelection;
};

const ReleaseArtifacts = ({params, location, selection}: Props) => (
  <ReleaseContext.Consumer>
    {release => {
      const project = release?.projects.find(p => p.id === selection.projects[0]);
      // TODO(releasesV2): we will handle this later with forced project selector
      if (!project) {
        return null;
      }

      return (
        <ContentBox>
          <Alert type="warning">
            {t(
              'We are working on improving this experience, therefore Artifacts will be moving to Settings soon.'
            )}
          </Alert>

          <ReleaseArtifactsV1
            params={params}
            location={location}
            projectId={project.slug}
          />
        </ContentBox>
      );
    }}
  </ReleaseContext.Consumer>
);

const ContentBox = styled('div')`
  padding: ${space(4)};
  flex: 1;
  background-color: ${p => p.theme.white};
`;

export default withGlobalSelection(ReleaseArtifacts);
