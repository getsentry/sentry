import React from 'react';
import cloneDeep from 'lodash/cloneDeep';

import WidgetQueryFields from 'app/components/dashboards/widgetQueryFields';
import {t} from 'app/locale';
import {TagCollection} from 'app/types';
import Measurements from 'app/utils/measurements/measurements';
import withTags from 'app/utils/withTags';
import {generateFieldOptions} from 'app/views/eventsV2/utils';

import {DisplayType} from '../../../types';
import BuildStep from '../buildStep';

import Queries from './queries';

type Props = Omit<React.ComponentProps<typeof Queries>, 'queries'> & {
  eventQueries: React.ComponentProps<typeof Queries>['queries'];
  tags: TagCollection;
  displayType: DisplayType;
};

function EventSteps({
  eventQueries,
  selectedProjectIds,
  organization,
  tags,
  displayType,
  onRemoveQuery,
  onAddQuery,
  onChangeQuery,
}: Props) {
  function fieldOptions(measurementKeys: string[]) {
    return generateFieldOptions({
      organization,
      tagKeys: Object.values(tags).map(({key}) => key),
      measurementKeys,
    });
  }

  return (
    <React.Fragment>
      <BuildStep
        title={t('Begin your search')}
        description={t('Add another query to compare projects, organizations, etc.')}
      >
        <Queries
          queries={eventQueries}
          selectedProjectIds={selectedProjectIds}
          organization={organization}
          displayType={displayType}
          onRemoveQuery={onRemoveQuery}
          onAddQuery={onAddQuery}
          onChangeQuery={onChangeQuery}
        />
      </BuildStep>
      <Measurements>
        {({measurements}) => {
          const measurementKeys = Object.values(measurements).map(({key}) => key);
          const amendedFieldOptions = fieldOptions(measurementKeys);
          const buildStepContent = (
            <WidgetQueryFields
              style={{padding: 0}}
              displayType={displayType}
              fieldOptions={amendedFieldOptions}
              fields={eventQueries[0].fields}
              onChange={fields => {
                eventQueries.forEach((eventQuery, queryIndex) => {
                  const newQuery = cloneDeep(eventQuery);
                  newQuery.fields = fields;
                  onChangeQuery(queryIndex, newQuery);
                });
              }}
            />
          );
          return (
            <BuildStep
              title={
                displayType === DisplayType.TABLE
                  ? t('Choose your columns')
                  : t('Choose your y-axis')
              }
              description={t(
                'We’ll use this to determine what gets graphed in the y-axis and any additional overlays.'
              )}
            >
              {buildStepContent}
            </BuildStep>
          );
        }}
      </Measurements>
    </React.Fragment>
  );
}

export default withTags(EventSteps);
