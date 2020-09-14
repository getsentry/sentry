import debounce from 'lodash/debounce';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import algoliasearch from 'algoliasearch';
import styled from '@emotion/styled';

import {
  ALGOLIA_APP_ID,
  ALGOLIA_READ_ONLY,
  ALGOLIA_DOCS_INDEX,
  ALGOLIA_ZENDESK_INDEX,
} from 'app/constants';
import parseHtmlMarks from 'app/utils/parseHtmlMarks';
import withLatestContext from 'app/utils/withLatestContext';

/**
 * Use unique markers for highlighting so we can parse these into fuse-style
 * indicidies.
 */
const HIGHLIGHT_TAGS = {
  highlightPreTag: '<algolia-highlight-0000000000>',
  highlightPostTag: '</algolia-highlight-0000000000>',
};

const SNIPPET_LENGTH = 260;

class HelpSource extends React.Component {
  static propTypes = {
    // search term
    query: PropTypes.string,

    /**
     * Render function that passes:
     * `isLoading` - loading state
     * `allResults` - All results returned from all queries: [searchIndex, model, type]
     * `results` - Results array filtered by `this.props.query`: [searchIndex, model, type]
     */
    children: PropTypes.func.isRequired,
  };

  constructor(props, ...args) {
    super(props, ...args);
    this.state = {
      loading: false,
      results: null,
    };

    this.algolia = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_READ_ONLY);
  }

  componentDidMount() {
    if (typeof this.props.query !== 'undefined') {
      this.doSearch(this.props.query);
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.query !== this.props.query) {
      this.doSearch(nextProps.query);
    }
  }

  async searchAlgolia(query) {
    this.setState({loading: true});

    const params = {
      hitsPerPage: 5,
      ...HIGHLIGHT_TAGS,
    };

    const response = await this.algolia.search([
      {
        query,
        params,
        indexName: ALGOLIA_DOCS_INDEX,
        attributesToSnippet: ['title', `content: ${SNIPPET_LENGTH}`],
      },
      {
        query,
        params,
        indexName: ALGOLIA_ZENDESK_INDEX,
        attributesToSnippet: ['title', `body_safe: ${SNIPPET_LENGTH}`],
      },
    ]);
    const [docResults, faqResults] = response.results;

    const results = [
      ...docResults.hits.map(result =>
        buildHit(result, {
          descriptionKey: 'content',
          type: 'doc',
          badge: <DocsBadge />,
          makeUrl: ({url}) => `https://docs.sentry.io${url}`,
        })
      ),
      ...faqResults.hits.map(result =>
        buildHit(result, {
          descriptionKey: 'body_safe',
          type: 'faq',
          badge: <FaqsBadge />,
          makeUrl: ({id}) => `https://help.sentry.io/hc/en-us/articles/${id}`,
        })
      ),
    ];

    this.setState({loading: false, results});
  }

  doSearch = debounce(this.searchAlgolia, 300);

  render() {
    return this.props.children({
      isLoading: this.state.loading,
      allResults: this.state.results,
      results: this.state.results,
    });
  }
}

/**
 * Maps an Algolia hit response over to a SearchResult item.
 */
function buildHit(hit, options) {
  const {_highlightResult, _snippetResult} = hit;
  const {descriptionKey, type, makeUrl, badge} = options;

  const title = parseHtmlMarks({
    key: 'title',
    htmlString: _highlightResult.title.value,
    markTags: HIGHLIGHT_TAGS,
  });
  const description = _snippetResult
    ? parseHtmlMarks({
        key: 'description',
        htmlString: _snippetResult[descriptionKey].value,
        markTags: HIGHLIGHT_TAGS,
      })
    : {};

  const item = {
    sourceType: 'help',
    resultType: type,
    resultIcon: badge,
    title: title.value,
    description: description.value,
    to: makeUrl(hit),
  };

  return {
    item,
    matches: [title, description],
  };
}

const ResultIcon = styled('div')`
  display: inline-block;
  font-size: 0.8em;
  line-height: 1;
  padding: 4px 6px;
  margin-left: 8px;
  border-radius: 11px;
  color: #fff;
`;

const DocsBadge = styled(p => <ResultIcon {...p}>docs</ResultIcon>)`
  background: ${p => p.theme.blue300};
`;

const FaqsBadge = styled(p => <ResultIcon {...p}>faqs</ResultIcon>)`
  background: ${p => p.theme.green300};
`;

export {HelpSource};
export default withLatestContext(withRouter(HelpSource));
