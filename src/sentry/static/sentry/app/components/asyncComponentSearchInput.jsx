import {debounce} from 'lodash';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Input from 'app/views/settings/components/forms/controls/input';
import LoadingIndicator from 'app/components/loadingIndicator';

/**
 * This is a search input that can be easily used in AsyncComponent/Views.
 *
 * It probably doesn't make too much sense outside of an AsyncComponent atm.
 */
class AsyncComponentSearchInput extends React.Component {
  static propTypes = {
    api: PropTypes.any.isRequired,
    url: PropTypes.string.isRequired,
    onSuccess: PropTypes.func.isRequired,
    onError: PropTypes.func.isRequired,
    // Updates URL with search query in the URL param: `query`
    updateRoute: PropTypes.bool,
    router: PropTypes.object.isRequired,
    placeholder: PropTypes.string,
    onSearchSubmit: PropTypes.func,
    debounceWait: PropTypes.number,
  };

  static defaultProps = {
    placeholder: 'Search...',
    debounceWait: 200,
  };

  constructor(props) {
    super(props);
    this.state = {
      query: '',
      busy: false,
    };
  }

  query = debounce(searchQuery => {
    const {router} = this.props;
    this.setState({busy: true});
    return this.props.api.request(`${this.props.url}`, {
      method: 'GET',
      query: {
        ...router.location.query,
        query: searchQuery,
      },
      success: (data, _, jqXHR) => {
        this.setState({busy: false});
        // only update data if the request's query matches the current query
        if (this.state.query === searchQuery) {
          this.props.onSuccess(data, jqXHR);
        }
      },
      error: () => {
        this.setState({busy: false});
        this.props.onError();
      },
    });
  }, this.props.debounceWait);

  handleChange = evt => {
    const searchQuery = evt.target.value;
    this.query(searchQuery);
    this.setState({query: searchQuery});
  };

  /**
   * This is called when "Enter" (more specifically a form "submit" event) is pressed.
   */
  handleSearch = evt => {
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
    const {placeholder, className} = this.props;
    return (
      <Form onSubmit={this.handleSearch}>
        <Input
          value={this.state.query}
          onChange={this.handleChange}
          className={className}
          placeholder={placeholder}
        />
        {this.state.busy && <StyledLoadingIndicator size="18px" mini />}
      </Form>
    );
  }
}

const StyledLoadingIndicator = styled(LoadingIndicator)`
  position: absolute;
  right: -6px;
  top: 3px;
`;

const Form = styled('form')`
  position: relative;
`;

export default withRouter(AsyncComponentSearchInput);
