import * as AppStoreConnectContext from 'app/components/projects/appStoreConnectContext';
import {Organization, Project} from 'app/types';

import UpdateAlert from './updateAlert';

type Props = Pick<
  React.ComponentProps<typeof UpdateAlert>,
  'isCompact' | 'className' | 'Wrapper'
> & {
  organization: Organization;
  project?: Project;
};

function GlobalAppStoreConnectUpdateAlert({project, organization, ...rest}: Props) {
  const hasAppConnectStoreFeatureFlag = !!organization.features?.includes(
    'app-store-connect'
  );

  if (!hasAppConnectStoreFeatureFlag) {
    return null;
  }

  return (
    <AppStoreConnectContext.Provider project={project} orgSlug={organization.slug}>
      <UpdateAlert project={project} organization={organization} {...rest} />
    </AppStoreConnectContext.Provider>
  );
}

export default GlobalAppStoreConnectUpdateAlert;
