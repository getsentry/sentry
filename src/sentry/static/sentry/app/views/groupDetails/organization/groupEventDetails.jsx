import React from 'react';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import OrganizationEnvironmentStore from 'app/stores/organizationEnvironmentsStore';

import GroupEventDetails from '../shared/groupEventDetails';

export default withGlobalSelection(props => {
  const {selection, ...otherProps} = props;
  const environments = OrganizationEnvironmentStore.getActive().filter(env =>
    selection.environments.includes(env.name)
  );

  return <GroupEventDetails {...otherProps} environments={environments} />;
});
