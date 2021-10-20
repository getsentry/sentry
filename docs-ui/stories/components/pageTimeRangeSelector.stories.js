import {Fragment} from 'react';
import omit from 'lodash/omit';

import DateTime from 'app/components/dateTime';
import PageTimeRangeSelector from 'app/components/pageTimeRangeSelector';
import {DEFAULT_RELATIVE_PERIODS} from 'app/constants';
import {t} from 'app/locale';

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
          <DateTime date={start} timeAndDate /> - <DateTime date={end} timeAndDate />)
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
