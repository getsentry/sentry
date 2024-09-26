import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import SwitchButton from 'sentry/components/switchButton';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {FlexContainer} from 'sentry/utils/discover/styles';
import useOrganization from 'sentry/utils/useOrganization';

import {ProjectSourceMaps} from './projectSourceMaps';
import {ProjectSourceMapsArtifacts} from './projectSourceMapsArtifacts';
import {ProjectSourceMapsUploads} from './projectSourceMapsUploads';

type Props = RouteComponentProps<
  {
    orgId: string;
    projectId: string;
    bundleId?: string;
    name?: string;
  },
  {}
> & {
  children: React.ReactNode;
  project: Project;
};

const hasSourceMapUploadsView = (org: Organization) =>
  org.features.includes('new-source-map-uploads-view');

export function ToggleSourceMapUploadsView({router}) {
  const useSourceMapUploadsView =
    router.location.query.useSourceMapUploadsView === 'true';

  const org = useOrganization();

  const toggle = useCallback(() => {
    const newVal = useSourceMapUploadsView ? undefined : 'true';
    router.push({
      ...location,
      query: {...router.location.query, useSourceMapUploadsView: newVal},
    });
  }, [router, useSourceMapUploadsView]);

  if (!hasSourceMapUploadsView(org)) {
    return null;
  }

  return (
    <SwitchButtonContainer
      style={{
        opacity: useSourceMapUploadsView ? 1.0 : 0.75,
        gap: space(1),
      }}
    >
      {t('New Source Maps Experience')}
      <SwitchButton isActive={useSourceMapUploadsView} size="sm" toggle={toggle} />
    </SwitchButtonContainer>
  );
}

const SwitchButtonContainer = styled(FlexContainer)`
  position: absolute;
  right: ${space(4)};
  padding: ${space(2)};
  top: 80px;
`;

export default function ProjectSourceMapsContainer({params, location, ...props}: Props) {
  const org = useOrganization();

  if (params.bundleId) {
    return (
      <ProjectSourceMapsArtifacts
        {...props}
        location={location}
        params={{...params, bundleId: params.bundleId}}
      />
    );
  }
  if (location.query.useSourceMapUploadsView === 'true' && hasSourceMapUploadsView(org)) {
    return (
      <Fragment>
        <ToggleSourceMapUploadsView router={props.router} />
        <ProjectSourceMapsUploads
          {...props}
          location={location}
          params={{...params, bundleId: params.bundleId!}}
        />
      </Fragment>
    );
  }

  return (
    <Fragment>
      <ToggleSourceMapUploadsView router={props.router} />
      <ProjectSourceMaps {...props} location={location} params={params} />
    </Fragment>
  );
}
