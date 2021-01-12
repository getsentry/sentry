import React from 'react';
import {Location} from 'history';

import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';

import DurationHistogram from './durationHistogram';

type Props = {
  location: Location;
  organization: Organization;
  eventView: EventView;

  onFrontendDisplayFilter: (queryUpdate: string) => void;
};

function FrontendDisplay(props: Props) {
  const onFilterChange = (minValue, maxValue, tagName) => {
    const conditions = tokenizeSearch('');
    conditions.setTagValues(tagName, [
      `>=${Math.round(minValue)}`,
      `<=${Math.round(maxValue)}`,
    ]);
    const query = stringifyQueryObject(conditions);
    props.onFrontendDisplayFilter(query);
  };
  return (
    <Panel>
      <DurationHistogram
        measurement="lcp"
        {...props}
        onFilterChange={onFilterChange}
        title={t('LCP Histogram')}
        titleTooltip={t(
          'This is a histogram of the largest contentful paint, a web vital meant to represent user load times'
        )}
      />
    </Panel>
  );
}

export default FrontendDisplay;
