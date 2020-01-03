import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

class SearchBar extends React.PureComponent {
  static propTypes = {
    query: PropTypes.string,
    defaultQuery: PropTypes.string,
    onSearch: PropTypes.func,
    placeholder: PropTypes.string,
  };

  static defaultProps = {
    defaultQuery: '',
    query: '',
    onSearch: function() {},
  };

  constructor(...args) {
    super(...args);
    this.state = {
      query: this.props.query || this.props.defaultQuery,
    };
    this.searchInputRef = React.createRef();
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.query !== this.props.query) {
      this.setState({
        query: nextProps.query,
      });
    }
  }

  blur = () => {
    this.searchInputRef.current.blur();
  };

  onSubmit = evt => {
    evt.preventDefault();
    this.blur();
    this.props.onSearch(this.state.query);
  };

  clearSearch = () => {
    this.setState({query: this.props.defaultQuery}, () =>
      this.props.onSearch(this.state.query)
    );
  };

  onQueryFocus = () => {
    this.setState({
      dropdownVisible: true,
    });
  };

  onQueryBlur = () => {
    this.setState({dropdownVisible: false});
  };

  onQueryChange = evt => {
    this.setState({query: evt.target.value});
  };

  render() {
    const {className} = this.props;
    return (
      <div className={classNames('search', className)}>
        <form className="form-horizontal" onSubmit={this.onSubmit}>
          <div>
            <input
              type="text"
              className="search-input form-control"
              placeholder={this.props.placeholder}
              name="query"
              ref={this.searchInputRef}
              autoComplete="off"
              value={this.state.query}
              onBlur={this.onQueryBlur}
              onChange={this.onQueryChange}
            />
            <span className="icon-search" />
            {this.state.query !== this.props.defaultQuery && (
              <div>
                <a className="search-clear-form" onClick={this.clearSearch}>
                  <span className="icon-circle-cross" />
                </a>
              </div>
            )}
          </div>
        </form>
      </div>
    );
  }
}

export default SearchBar;
