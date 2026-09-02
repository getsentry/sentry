import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {ErrorsQueryLink} from './errorsQueryLink';

const LazyErrorsQueryBlock = lazy(() => import('./errorsQueryBlock'));

export const ErrorsQuery = defineSeerEmbed({
  name: 'errorsQuery',
  render(props, level) {
    if (level === 'block') {
      return <LazyLoad LazyComponent={LazyErrorsQueryBlock} data={props} kind="events" />;
    }
    return <ErrorsQueryLink data={props} kind="events" />;
  },
});

export const ErrorsQueryAggregate = defineSeerEmbed({
  name: 'errorsQueryAggregate',
  render(props, level) {
    if (level === 'block') {
      return (
        <LazyLoad LazyComponent={LazyErrorsQueryBlock} data={props} kind="aggregate" />
      );
    }
    return <ErrorsQueryLink data={props} kind="aggregate" />;
  },
});
