import React from 'react';
import classNames from 'classnames';

type Props = {
  query: string;
  defaultQuery: string;
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
};

type State = {
  query: string;
  dropdownVisible: boolean;
};

class SearchBar extends React.PureComponent<Props, State> {
  static defaultProps: Partial<Props> = {
    query: '',
    defaultQuery: '',
    onSearch: function() {},
  };

  state = {
    query: this.props.query || this.props.defaultQuery,
    dropdownVisible: false,
  };

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.query !== this.props.query) {
      this.setState({
        query: nextProps.query,
      });
    }
  }

  searchInputRef = React.createRef<HTMLInputElement>();

  blur = () => {
    if (this.searchInputRef.current) {
      this.searchInputRef.current.blur();
    }
  };

  onSubmit = (evt: React.FormEvent<HTMLFormElement>) => {
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

  onQueryChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
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
