import {Location} from 'history';

import Button from 'app/components/button';
import {extractSelectionParameters} from 'app/components/organizations/globalSelectionHeader/utils';
import {t} from 'app/locale';
import {ReleaseProject} from 'app/types';

type Props = {
  orgSlug: string;
  releaseVersion: string;
  project: ReleaseProject;
  location: Location;
};

const ProjectLink = ({orgSlug, releaseVersion, project, location}: Props) => (
  <Button
    size="xsmall"
    to={{
      pathname: `/organizations/${orgSlug}/releases/${encodeURIComponent(
        releaseVersion
      )}/`,
      query: {
        ...extractSelectionParameters(location.query),
        project: project.id,
        yAxis: undefined,
      },
    }}
  >
    {t('View')}
  </Button>
);

export default ProjectLink;
