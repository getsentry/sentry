import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import {
  Result as SearchResult,
  SentryGlobalSearch,
  standardSDKSlug,
} from '@sentry-internal/global-search';
import dompurify from 'dompurify';
import debounce from 'lodash/debounce';

import {Organization, Project} from 'sentry/types';
import parseHtmlMarks from 'sentry/utils/parseHtmlMarks';
import withLatestContext from 'sentry/utils/withLatestContext';

import {ChildProps, Result, ResultItem} from './types';

type Props = WithRouterProps & {
  /**
   * Render function that renders the global search result
   */
  children: (props: ChildProps) => React.ReactNode;
  organization: Organization;
  /**
   * Specific platforms to filter reults to
   */
  platforms: string[];
  project: Project;
  /**
   * The string to search the navigation routes for
   */
  query: string;
};

type State = {
  loading: boolean;
  results: Result[];
};

const MARK_TAGS = {
  highlightPreTag: '<mark>',
  highlightPostTag: '</mark>',
};

class HelpSource extends React.Component<Props, State> {
  state: State = {
    loading: false,
    results: [],
  };

  componentDidMount() {
    if (this.props.query !== undefined) {
      this.doSearch(this.props.query);
    }
  }

  componentDidUpdate(nextProps: Props) {
    if (nextProps.query !== this.props.query) {
      this.doSearch(nextProps.query);
    }
  }

  search = new SentryGlobalSearch(['docs', 'help-center', 'develop', 'blog']);

  async unbouncedSearch(query: string) {
    this.setState({loading: true});
    const {platforms = []} = this.props;

    const searchResults = await this.search.query(query, {
      platforms: platforms.map(platform => standardSDKSlug(platform)?.slug!),
    });
    const results = mapSearchResults(searchResults);

    this.setState({loading: false, results});
  }

  doSearch = debounce(this.unbouncedSearch, 300);

  render() {
    return this.props.children({
      isLoading: this.state.loading,
      results: this.state.results,
    });
  }
}

function mapSearchResults(results: SearchResult[]) {
  const items: Result[] = [];

  results.forEach(section => {
    const sectionItems = section.hits.map(hit => {
      const title = parseHtmlMarks({
        key: 'title',
        htmlString: hit.title ?? '',
        markTags: MARK_TAGS,
      });
      const description = parseHtmlMarks({
        key: 'description',
        htmlString: hit.text ?? '',
        markTags: MARK_TAGS,
      });

      const item: ResultItem = {
        ...hit,
        sourceType: 'help',
        resultType: `help-${hit.site}` as ResultItem['resultType'],
        title: dompurify.sanitize(hit.title ?? ''),
        extra: hit.context.context1,
        description: hit.text ? dompurify.sanitize(hit.text) : undefined,
        to: hit.url,
      };

      return {item, matches: [title, description], score: 1, refIndex: 0};
    });

    // The first element should indicate the section.
    if (sectionItems.length > 0) {
      sectionItems[0].item.sectionHeading = section.name;
      sectionItems[0].item.sectionCount = sectionItems.length;

      items.push(...sectionItems);
      return;
    }

    // If we didn't have any results for this section mark it as empty
    const emptyHeaderItem: ResultItem = {
      sourceType: 'help',
      resultType: `help-${section.site}` as ResultItem['resultType'],
      title: `No results in ${section.name}`,
      sectionHeading: section.name,
      empty: true,
    };

    items.push({item: emptyHeaderItem, score: 1, refIndex: 0});
  });

  return items;
}

export {HelpSource};
export default withLatestContext(withRouter(HelpSource));
