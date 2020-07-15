import React from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {IconClose} from 'app/icons/iconClose';
import {callIfFunction} from 'app/utils/callIfFunction';
import {IconSearch} from 'app/icons';

type DefaultProps = {
  query: string;
  defaultQuery: string;
  onSearch: (query: string) => void;
};

type Props = DefaultProps & {
  placeholder?: string;
  className?: string;
  onChange?: (query: string) => void;
  width?: string;
};

type State = {
  query: string;
  dropdownVisible: boolean;
};

class SearchBar extends React.PureComponent<Props, State> {
  static defaultProps: DefaultProps = {
    query: '',
    defaultQuery: '',
    onSearch: function() {},
  };

  state = {
    query: this.props.query || this.props.defaultQuery,
    dropdownVisible: false,
  };

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
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
    this.setState({query: this.props.defaultQuery}, () => {
      this.props.onSearch(this.state.query);
      callIfFunction(this.props.onChange, this.state.query);
    });
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
    const {value} = evt.target;

    this.setState({query: value});
    callIfFunction(this.props.onChange, value);
  };

  render() {
    const {className, width} = this.props;

    return (
      <div className={classNames('search', className)}>
        <form className="form-horizontal" onSubmit={this.onSubmit}>
          <div>
            <Input
              type="text"
              className="search-input form-control"
              placeholder={this.props.placeholder}
              name="query"
              ref={this.searchInputRef}
              autoComplete="off"
              value={this.state.query}
              onBlur={this.onQueryBlur}
              onChange={this.onQueryChange}
              width={width}
            />
            <StyledIconSearch className="search-input-icon" size="sm" color="gray500" />
            {this.state.query !== this.props.defaultQuery && (
              <div>
                <a className="search-clear-form" onClick={this.clearSearch}>
                  <IconClose />
                </a>
              </div>
            )}
          </div>
        </form>
      </div>
    );
  }
}

const Input = styled('input')`
  width: ${p => (p.width ? p.width : undefined)};
`;

const StyledIconSearch = styled(IconSearch)`
  position: absolute;
  top: 13px;
  left: 14px;
`;

export default SearchBar;
