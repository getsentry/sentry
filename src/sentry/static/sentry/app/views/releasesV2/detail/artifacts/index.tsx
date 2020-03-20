import React from 'react';
import styled from '@emotion/styled';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';

import {t} from 'app/locale';
import Alert from 'app/components/alert';
import space from 'app/styles/space';
import ReleaseArtifactsV1 from 'app/views/releases/detail/releaseArtifacts';

import {ReleaseContext} from '..';

type Props = {
  params: Params;
  location: Location;
};

const ReleaseArtifacts = ({params, location}: Props) => (
  <ReleaseContext.Consumer>
    {({project}) => (
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
          smallEmptyMessage
        />
      </ContentBox>
    )}
  </ReleaseContext.Consumer>
);

const ContentBox = styled('div')`
  padding: ${space(4)};
  flex: 1;
  background-color: ${p => p.theme.white};
`;

export default ReleaseArtifacts;
