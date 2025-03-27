import {Component} from 'react';

import {loadSearchMap} from 'sentry/actionCreators/formSearch';
import type {FormSearchField} from 'sentry/stores/formSearchStore';
import FormSearchStore from 'sentry/stores/formSearchStore';
import type {WithRouterProps} from 'sentry/types/legacyReactRouter';
import type {Fuse} from 'sentry/utils/fuzzySearch';
import {createFuzzySearch} from 'sentry/utils/fuzzySearch';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';

import type {ChildProps, Result, ResultItem} from './types';
import {makeResolvedTs, strGetFn} from './utils';

interface Props extends WithRouterProps {
  children: (props: ChildProps) => React.ReactElement;
  /**
   * search term
   */
  query: string;
  /**
   * List of form fields to search
   */
  searchMap?: null | FormSearchField[];
  /**
   * fusejs options.
   */
  searchOptions?: Fuse.IFuseOptions<FormSearchField>;
}

type State = {
  fuzzy: null | Fuse<FormSearchField>;
  resolvedTs: number;
};

class FormSource extends Component<Props, State> {
  static defaultProps = {
    searchOptions: {},
  };
  state: State = {
    fuzzy: null,
    resolvedTs: 0,
  };

  componentDidMount() {
    this.createSearch(this.props.searchMap);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.searchMap !== prevProps.searchMap) {
      this.createSearch(this.props.searchMap);
    }
  }

  async createSearch(searchMap: Props['searchMap']) {
    const fuzzy = await createFuzzySearch(searchMap || [], {
      ...this.props.searchOptions,
      keys: ['title', 'description'],
      getFn: strGetFn,
    });
    const resolvedTs = makeResolvedTs();

    this.setState({fuzzy, resolvedTs});
  }

  render() {
    const {searchMap, query, children} = this.props;
    const {fuzzy, resolvedTs} = this.state;

    const results =
      fuzzy?.search(query).map<Result>(value => {
        const {item, ...rest} = value;
        return {
          item: {
            ...item,
            sourceType: 'field',
            resultType: 'field',
            to: {pathname: item.route, hash: `#${encodeURIComponent(item.field.name)}`},
            resolvedTs,
          } as ResultItem,
          ...rest,
        };
      }) ?? [];

    return children({
      isLoading: searchMap === null,
      results,
    });
  }
}

type ContainerProps = Omit<Props, 'searchMap'>;
type ContainerState = Pick<Props, 'searchMap'>;

class FormSourceContainer extends Component<ContainerProps, ContainerState> {
  state = {
    searchMap: FormSearchStore.get(),
  };

  componentDidMount() {
    // Loads form fields
    loadSearchMap();
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  unsubscribe = FormSearchStore.listen(
    (searchMap: ContainerState['searchMap']) => this.setState({searchMap}),
    undefined
  );

  render() {
    return <FormSource searchMap={this.state.searchMap} {...this.props} />;
  }
}
export default withSentryRouter(FormSourceContainer);
