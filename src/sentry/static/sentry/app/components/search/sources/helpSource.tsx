import React from 'react';
import debounce from 'lodash/debounce';
import dompurify from 'dompurify';
import {withRouter, WithRouterProps} from 'react-router';
import {
  SentryGlobalSearch,
  standardSDKSlug,
  Result as SearchResult,
} from '@sentry-internal/global-search';

import withLatestContext from 'app/utils/withLatestContext';
import {Organization, Project} from 'app/types';
import parseHtmlMarks from 'app/utils/parseHtmlMarks';

type MarkedText = ReturnType<typeof parseHtmlMarks>;

type ResultItem = {
  sourceType: 'help';
  resultType: string;
  title: string;
  description?: string;
  to?: string;
  /**
   * Context will be mapped into the extra node
   */
  extra?: string;
  /**
   * Section heading is declared when the first result designates a section of the
   * global search results.
   */
  sectionHeading?: string;
  sectionCount?: number;
  empty?: boolean;
} & (
  | SearchResult['hits'][0]
  | {
      /**
       * When we have no results for a section we mark the result item as empty
       */
      empty?: true;
    }
);

type Result = {
  item: ResultItem;
  matches?: MarkedText[];
};

type RenderProps = {
  isLoading: boolean;
  /**
   * Matched results
   */
  results: Result[];
  allResults: Result[];
};

type Props = WithRouterProps & {
  organization: Organization;
  project: Project;
  /**
   * Specific platforms to filter reults to
   */
  platforms: string[];
  /**
   * The string to search the navigation routes for
   */
  query: string;
  /**
   * Render function that renders the global search result
   */
  children: (props: RenderProps) => React.ReactNode;
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
      allResults: this.state.results,
      results: this.state.results,
    });
  }
}

function mapSearchResults(results: SearchResult[]) {
  const items: Result[] = [];

  results.forEach(section => {
    const sectionItems = section.hits.map<Result>(hit => {
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
        resultType: `help-${hit.site}`,
        title: dompurify.sanitize(hit.title ?? ''),
        extra: hit.context.context1,
        description: hit.text ? dompurify.sanitize(hit.text) : undefined,
        to: hit.url,
      };

      return {item, matches: [title, description]};
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
      resultType: `help-${section.site}`,
      title: `No results in ${section.name}`,
      sectionHeading: section.name,
      empty: true,
    };

    items.push({item: emptyHeaderItem});
  });

  return items;
}

export {HelpSource};
export default withLatestContext(withRouter(HelpSource));
