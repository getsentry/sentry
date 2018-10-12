import {debounce} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import Input from 'app/views/settings/components/forms/controls/input';

/**
 * This is a search input that can be easily used in AsyncComponent/Views.
 *
 * It probably doesn't make too much sense outside of an AsyncComponent atm.
 */
export default class AsyncComponentSearchInput extends React.Component {
  static propTypes = {
    api: PropTypes.any.isRequired,
    url: PropTypes.string.isRequired,
    onSuccess: PropTypes.func.isRequired,
    onError: PropTypes.func.isRequired,
    placeholder: PropTypes.string,
    onSearchSubmit: PropTypes.func,
  };

  static defaultProps = {
    placeholder: 'Search...',
  };

  constructor(props) {
    super(props);
    this.state = {
      query: '',
    };
  }

  query = debounce(searchQuery => {
    return this.props.api.request(`${this.props.url}?query=${searchQuery}`, {
      method: 'GET',
      success: (data, _, jqXHR) => {
        this.props.onSuccess(data, jqXHR);
      },
      error: () => {
        this.props.onError();
      },
    });
  }, 200);

  handleChange = evt => {
    let searchQuery = evt.target.value;
    this.query(searchQuery);
    this.setState({query: searchQuery});
  };

  handleSearch = evt => {
    let {onSearchSubmit} = this.props;
    evt.preventDefault();
    if (typeof onSearchSubmit !== 'function') return;
    onSearchSubmit(this.state.query, evt);
  };

  render() {
    let {placeholder, className} = this.props;
    return (
      <form onSubmit={this.handleSearch}>
        <Input
          value={this.state.query}
          onChange={this.handleChange}
          className={className}
          placeholder={placeholder}
        />
      </form>
    );
  }
}
