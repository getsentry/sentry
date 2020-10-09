import React from 'react';
import pick from 'lodash/pick';

import {Tag} from 'app/actionCreators/events';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import withApi from 'app/utils/withApi';

import GenericDiscoverQuery, {DiscoverQueryProps} from './genericDiscoverQuery';

type Props = DiscoverQueryProps & {
  tags?: string[];
};

function TagsQuery(props: Props) {
  return (
    <GenericDiscoverQuery<Tag[], {}>
      route="events-facets"
      getRequestPayload={getFacetsRequestPayload}
      {...props}
    />
  );
}

function getFacetsRequestPayload(props: any) {
  const {eventView, location, tags} = props;

  const query = eventView.getFacetsAPIPayload(location);
  return {
    ...pick(query, Object.values(URL_PARAM)),
    query: query.query,
    tag: tags,
  };
}

export default withApi(TagsQuery);
