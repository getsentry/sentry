import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Client, ResponseMeta} from 'sentry/api';
import Input from 'sentry/components/forms/controls/input';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';

type RenderProps = {
  busy: boolean;
  defaultSearchBar: React.ReactNode;
  handleChange: (value: string) => void;
  value: string;
};

type DefaultProps = {
  /**
   * Placeholder text in the search input
   */
  placeholder: string;
  /**
   * Time in milliseconds to wait before firing off the request
   */
  debounceWait?: number; // optional, otherwise app/views/settings/organizationMembers/organizationMembersList.tsx L:191 is not happy
};

type Props = WithRouterProps &
  DefaultProps & {
    api: Client;
    onError: () => void;
    onSuccess: (data: object, resp: ResponseMeta | undefined) => void;
    /**
     * URL to make the search request to
     */
    url: string;

    /**
     * A render-prop child may be passed to handle custom rendering of the input.
     */
    children?: (otps: RenderProps) => React.ReactNode;
    className?: string;
    onSearchSubmit?: (query: string, event: React.FormEvent) => void;

    /**
     * Updates URL with search query in the URL param: `query`
     */
    updateRoute?: boolean;
  };

type State = {
  busy: boolean;
  query: string;
};

/**
 * This is a search input that can be easily used in AsyncComponent/Views.
 *
 * It probably doesn't make too much sense outside of an AsyncComponent atm.
 */
class AsyncComponentSearchInput extends React.Component<Props, State> {
  static defaultProps: DefaultProps = {
    placeholder: t('Search...'),
    debounceWait: 200,
  };

  state: State = {
    query: '',
    busy: false,
  };

  immediateQuery = async (searchQuery: string) => {
    const {location, api} = this.props;
    this.setState({busy: true});

    try {
      const [data, , resp] = await api.requestPromise(`${this.props.url}`, {
        includeAllArgs: true,
        method: 'GET',
        query: {...location.query, query: searchQuery},
      });
      // only update data if the request's query matches the current query
      if (this.state.query === searchQuery) {
        this.props.onSuccess(data, resp);
      }
    } catch {
      this.props.onError();
    }

    this.setState({busy: false});
  };

  query = debounce(this.immediateQuery, this.props.debounceWait);

  handleChange = (query: string) => {
    this.query(query);
    this.setState({query});
  };

  handleInputChange = (evt: React.ChangeEvent<HTMLInputElement>) =>
    this.handleChange(evt.target.value);

  /**
   * This is called when "Enter" (more specifically a form "submit" event) is pressed.
   */
  handleSearch = (evt: React.FormEvent<HTMLFormElement>) => {
    const {updateRoute, onSearchSubmit} = this.props;
    evt.preventDefault();

    // Update the URL to reflect search term.
    if (updateRoute) {
      const {router, location} = this.props;
      router.push({
        pathname: location.pathname,
        query: {
          query: this.state.query,
        },
      });
    }

    if (typeof onSearchSubmit !== 'function') {
      return;
    }
    onSearchSubmit(this.state.query, evt);
  };

  render() {
    const {placeholder, children, className} = this.props;
    const {busy, query} = this.state;

    const defaultSearchBar = (
      <Form onSubmit={this.handleSearch}>
        <Input
          value={query}
          onChange={this.handleInputChange}
          className={className}
          placeholder={placeholder}
        />
        {busy && <StyledLoadingIndicator size={18} hideMessage mini />}
      </Form>
    );

    return children === undefined
      ? defaultSearchBar
      : children({defaultSearchBar, busy, value: query, handleChange: this.handleChange});
  }
}

const StyledLoadingIndicator = styled(LoadingIndicator)`
  position: absolute;
  right: 25px;
  top: 50%;
  transform: translateY(-13px);
`;

const Form = styled('form')`
  position: relative;
`;

export default withRouter(AsyncComponentSearchInput);
