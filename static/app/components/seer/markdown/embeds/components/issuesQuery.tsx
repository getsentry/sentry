import {lazy} from 'react';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {resourceLinkMarkdown} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

import {IssuesQueryLink} from './issuesQueryLink';

const LazyIssuesQueryBlock = lazy(() => import('./issuesQueryBlock'));

export const IssuesQuery = defineSeerEmbed({
  name: 'issuesQuery',
  render(props, level) {
    switch (level) {
      case 'markdown':
        // The preview rows are live data, but the search itself carries over as
        // a link, so a reader can open the same query the block was drawn from.
        return <IssuesQueryLink {...props} format="markdown" />;
      case 'block':
        return <LazyLoad LazyComponent={LazyIssuesQueryBlock} data={props} />;
      case 'inline':
        return <IssuesQueryLink {...props} />;
    }
  },
});

export const LegacyIssues = defineSeerEmbed({
  name: 'issues',
  render({ids}, level) {
    switch (level) {
      case 'markdown':
        // The columns are live data; the list of issues is what survives. One
        // line rather than a bulleted list, because the lexer can hand this tag
        // over inline and a list would break the sentence around it.
        return ids
          .flatMap(id => resourceLinkMarkdown(`/issues/${id}/`, id) ?? [])
          .join(', ');
      case 'block':
      case 'inline':
        return (
          <LazyLoad
            LazyComponent={LazyIssuesQueryBlock}
            data={{query: `issue:[${ids.join(',')}]`}}
            rowLimit={ids.length}
          />
        );
    }
  },
});
