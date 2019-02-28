import React from 'react';

import withEnvironmentInQueryString from 'app/utils/withEnvironmentInQueryString';
import GroupEventDetails from '../shared/groupEventDetails';

export default withEnvironmentInQueryString(props => {
  const {environment, ...otherProps} = props;
  return (
    <GroupEventDetails {...otherProps} environments={environment ? [environment] : []} />
  );
});
