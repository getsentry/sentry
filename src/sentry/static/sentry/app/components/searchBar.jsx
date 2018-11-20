import PropTypes from 'prop-types';
import React from 'react';
import styled, {cx} from 'react-emotion';

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
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.query !== this.props.query) {
      this.setState({
        query: nextProps.query,
      });
    }
  }

  blur = () => {
    this.searchInput.blur();
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

  // render() {
  // let {className} = this.props;
  // return (
  // <div className={cx('search', className)}>
  // <form className="form-horizontal" onSubmit={this.onSubmit}>
  // <div>
  // <input
  // type="text"
  // className="search-input form-control"
  // placeholder={this.props.placeholder}
  // name="query"
  // ref={el => (this.searchInput = el)}
  // autoComplete="off"
  // value={this.state.query}
  // onBlur={this.onQueryBlur}
  // onChange={this.onQueryChange}
  // />
  // <span className="icon-search" />
  // {this.state.query !== this.props.defaultQuery && (
  // <div>
  // <a className="search-clear-form" onClick={this.clearSearch}>
  // <span className="icon-circle-cross" />
  // </a>
  // </div>
  // )}
  // </div>
  // </form>
  // </div>
  // );
  // }

  render() {
    let {className, disabled, children, ...props} = this.props;
    <Form onSubmit={this.onSubmit} className={className}>
      <StyledInput
        type="text"
        disabled={disabled}
        placeholder={this.props.placeholder}
        name="query"
        ref={this.searchInput}
        autoComplete="off"
        value={this.state.query}
        onFocus={this.onQueryFocus}
        onBlur={this.onQueryBlur}
        onKeyUp={this.onKeyUp}
        onKeyDown={this.onKeyDown}
        onChange={this.onQueryChange}
        onClick={this.onInputClick}
        dropdownVisble={this.state.dropdownVisible}
      />
      <SearchIcon disabled={disabled} className="icon-search" />

      {this.state.query !== '' && (
        <ClearSearch
          size="zero"
          borderless
          label="Clear Stream Search"
          onClick={this.clearSearch}
        >
          <span className="icon-circle-cross" />
        </ClearSearch>
      )}

      {children &&
        children({
          ...props,
          disabled,
          dropdownVisible: this.state.dropdownVisible,
        })}
    </Form>;
  }
}

// display: block;
const Form = styled('form')`
  position: relative;
`;

const StyledInput = styled('input')`
  ${legacyFormControl};

  padding: 8px 24px 8px 37px;
  font-size: 14px;
  background: #fff;
  transition: none;
  ${p =>
    p.disabled &&
    `
    border: 1px solid #ece9ef;
    background: #fbfbfc;
    color: #968ba0;
    box-shadow: none;
  `};

  ${p => p.hasDropdown && 'border-radius: 3px 3px 0 0;'};
`;

const SearchIcon = styled('span')`
  color: ${p => (p.disabled ? '#968ba0' : '#89779a')};
  position: absolute;
  top: 12px;
  left: 14px;
  font-size: 14px;
`;

const ClearSearch = styled(Button)`
  position: absolute;
  top: 8px;
  right: 10px;
  color: #afa3bb;
  font-size: 18px;

  &:hover {
    color: #7c6a8e;
  }

  @media (max-width: 767px) {
    .search-clear-form {
      top: 10px;
    }
  }
`;

export default SearchBar;
