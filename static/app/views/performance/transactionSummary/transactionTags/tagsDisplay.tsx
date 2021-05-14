import React from 'react';
import {withTheme} from '@emotion/react';
import {Location} from 'history';

import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import TagKeyHistogramQuery from 'app/utils/performance/segmentExplorer/tagKeyHistogramQuery';

import {SpanOperationBreakdownFilter} from '../filter';
import {getTransactionField} from '../tagExplorer';

import TagsHeatMap from './tagsHeatMap';
import {TagValueTable} from './tagValueTable';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  transactionName: string;
  tagKey: string;
};

const TAG_VALUE_LIMIT = 10;

const TagsDisplay = (props: Props) => {
  const {eventView, location, organization, projects, tagKey} = props;
  const aggregateColumn = getTransactionField(
    SpanOperationBreakdownFilter.None,
    projects,
    eventView
  );
  if (!tagKey) {
    return null;
  }
  return (
    <React.Fragment>
      <TagKeyHistogramQuery
        eventView={eventView}
        orgSlug={organization.slug}
        location={location}
        aggregateColumn={aggregateColumn}
        limit={TAG_VALUE_LIMIT}
        tagKey={tagKey}
        sort="-frequency"
      >
        {({isLoading, tableData}) => {
          return <TagsHeatMap {...props} tableData={tableData} isLoading={isLoading} />;
        }}
      </TagKeyHistogramQuery>
      <TagValueTable {...props} limit={TAG_VALUE_LIMIT} />
    </React.Fragment>
  );
};

export default withTheme(TagsDisplay);
