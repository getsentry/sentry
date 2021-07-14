import React from 'react';
import {withTheme} from '@emotion/react';
import {Location} from 'history';

import Placeholder from 'app/components/placeholder';
import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import SegmentExplorerQuery from 'app/utils/performance/segmentExplorer/segmentExplorerQuery';
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
  tagKey?: string;
};

const HISTOGRAM_TAG_KEY_LIMIT = 8;
const HISTOGRAM_BUCKET_LIMIT = 20;

const TagsDisplay = (props: Props) => {
  const {eventView, location, organization, projects, tagKey} = props;
  const aggregateColumn = getTransactionField(
    SpanOperationBreakdownFilter.None,
    projects,
    eventView
  );
  return (
    <React.Fragment>
      {tagKey ? (
        <React.Fragment>
          <TagKeyHistogramQuery
            eventView={eventView}
            orgSlug={organization.slug}
            location={location}
            aggregateColumn={aggregateColumn}
            tagKeyLimit={HISTOGRAM_TAG_KEY_LIMIT}
            numBucketsPerKey={HISTOGRAM_BUCKET_LIMIT}
            tagKey={tagKey}
            sort="-frequency"
          >
            {({isLoading, tableData}) => {
              return (
                <TagsHeatMap
                  {...props}
                  tagKey={tagKey}
                  aggregateColumn={aggregateColumn}
                  tableData={tableData}
                  isLoading={isLoading}
                />
              );
            }}
          </TagKeyHistogramQuery>
          <SegmentExplorerQuery
            eventView={eventView}
            orgSlug={organization.slug}
            location={location}
            aggregateColumn={aggregateColumn}
            tagKey={tagKey}
            limit={HISTOGRAM_TAG_KEY_LIMIT}
            sort="-frequency"
            allTagKeys
          >
            {({isLoading, tableData}) => {
              return (
                <TagValueTable
                  {...props}
                  tagKey={tagKey}
                  aggregateColumn={aggregateColumn}
                  tableData={tableData}
                  isLoading={isLoading}
                />
              );
            }}
          </SegmentExplorerQuery>
        </React.Fragment>
      ) : (
        <Placeholder height="290" />
      )}
    </React.Fragment>
  );
};

export default withTheme(TagsDisplay);
