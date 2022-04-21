import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';

import {loadSearchMap} from 'sentry/actionCreators/formSearch';
import FormSearchStore, {FormSearchField} from 'sentry/stores/formSearchStore';
import {createFuzzySearch, Fuse} from 'sentry/utils/fuzzySearch';
import replaceRouterParams from 'sentry/utils/replaceRouterParams';

import {ChildProps, Result, ResultItem} from './types';
import {strGetFn} from './utils';

type Props = WithRouterProps<{orgId: string}> & {
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
};

type State = {
  fuzzy: null | Fuse<FormSearchField>;
};

class FormSource extends React.Component<Props, State> {
  static defaultProps = {
    searchOptions: {},
  };
  state: State = {
    fuzzy: null,
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
    this.setState({
      fuzzy: await createFuzzySearch(searchMap || [], {
        ...this.props.searchOptions,
        keys: ['title', 'description'],
        getFn: strGetFn,
      }),
    });
  }

  render() {
    const {searchMap, query, params, children} = this.props;
    const {fuzzy} = this.state;

    const results =
      fuzzy?.search(query).map<Result>(value => {
        const {item, ...rest} = value;
        return {
          item: {
            ...item,
            sourceType: 'field',
            resultType: 'field',
            to: `${replaceRouterParams(item.route, params)}#${encodeURIComponent(
              item.field.name
            )}`,
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

class FormSourceContainer extends React.Component<ContainerProps, ContainerState> {
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
export default withRouter(FormSourceContainer);
