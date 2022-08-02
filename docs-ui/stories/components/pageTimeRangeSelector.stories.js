import {Fragment} from 'react';
import omit from 'lodash/omit';

import DateTime from 'sentry/components/dateTime';
import PageTimeRangeSelector from 'sentry/components/pageTimeRangeSelector';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';

export default {
  title: 'Components/PageTimeRangeSelector',
  component: PageTimeRangeSelector,
};

const start = '2021-07-25T08:49:32Z';
const end = '2021-07-27T12:55:17Z';

export const _PageTimeRangeSelector = () => <PageTimeRangeSelector />;
_PageTimeRangeSelector.storyName = 'Basic';

export const _PageTimeRangeSelectorWithDefault = () => (
  <PageTimeRangeSelector defaultPeriod="90d" />
);
_PageTimeRangeSelectorWithDefault.storyName = 'With Custom Default';

export const _PageTimeRangeSelectorWithOptions = () => (
  <PageTimeRangeSelector
    relativeOptions={{
      release: (
        <Fragment>
          {t('Entire Release Period')} (
          <DateTime date={start} /> - <DateTime date={end} />)
        </Fragment>
      ),
      ...omit(DEFAULT_RELATIVE_PERIODS, ['1h']),
    }}
    defaultPeriod="release"
  />
);
_PageTimeRangeSelectorWithOptions.storyName = 'With Custom Options';

export const _PageTimeRangeSelectorWithoutAbsolute = () => (
  <PageTimeRangeSelector showAbsolute={false} />
);
_PageTimeRangeSelectorWithoutAbsolute.storyName = 'Without Absolute';
