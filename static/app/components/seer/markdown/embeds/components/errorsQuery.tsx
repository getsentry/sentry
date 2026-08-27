import {ErrorsQueryBlock} from 'sentry/components/seer/markdown/embeds/components/errorsQueryBlock';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {ErrorsQueryLink} from './errorsQueryLink';

export const ErrorsQuery = defineSeerEmbed({
  name: 'errorsQuery',
  render(props, level) {
    return level === 'block' ? (
      <ErrorsQueryBlock data={props} kind="events" />
    ) : (
      <ErrorsQueryLink data={props} kind="events" />
    );
  },
});

export const ErrorsQueryAggregate = defineSeerEmbed({
  name: 'errorsQueryAggregate',
  render(props, level) {
    return level === 'block' ? (
      <ErrorsQueryBlock data={props} kind="aggregate" />
    ) : (
      <ErrorsQueryLink data={props} kind="aggregate" />
    );
  },
});
