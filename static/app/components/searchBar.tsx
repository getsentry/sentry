import * as React from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import Button from 'sentry/components/button';
import Input from 'sentry/components/forms/controls/input';
import {IconSearch} from 'sentry/icons';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {callIfFunction} from 'sentry/utils/callIfFunction';

type DefaultProps = {
  defaultQuery: string;
  onSearch: (query: string) => void;
  query: string;
};

type Props = DefaultProps & {
  onChange?: (query: string) => void;
  width?: string;
} & Omit<React.ComponentProps<typeof Input>, 'onChange'>;

type State = {
  dropdownVisible: boolean;
  query: string;
};

class SearchBar extends React.PureComponent<Props, State> {
  static defaultProps: DefaultProps = {
    query: '',
    defaultQuery: '',
    onSearch: function () {},
  };

  state: State = {
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
    // Remove keys that should not be passed into Input
    const {
      className,
      width,
      query: _q,
      defaultQuery,
      onChange: _oC,
      onSearch: _oS,
      ...inputProps
    } = this.props;

    return (
      <div className={classNames('search', className)}>
        <form className="form-horizontal" onSubmit={this.onSubmit}>
          <div>
            <StyledInput
              {...inputProps}
              type="text"
              className="search-input"
              name="query"
              ref={this.searchInputRef}
              autoComplete="off"
              value={this.state.query}
              onBlur={this.onQueryBlur}
              onChange={this.onQueryChange}
              width={width}
            />
            <StyledIconSearch className="search-input-icon" size="sm" color="gray300" />
            {this.state.query !== defaultQuery && (
              <SearchClearButton
                type="button"
                className="search-clear-form"
                priority="link"
                onClick={this.clearSearch}
                size="xsmall"
                icon={<IconClose />}
                aria-label={t('Clear')}
              />
            )}
          </div>
        </form>
      </div>
    );
  }
}

const StyledInput = styled(Input)`
  width: ${p => (p.width ? p.width : undefined)};

  &.focus-visible {
    box-shadow: 0 0 0 1px ${p => p.theme.focusBorder};
    border-color: ${p => p.theme.focusBorder};
    outline: none;
  }
`;

const StyledIconSearch = styled(IconSearch)`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  left: 14px;
`;

const SearchClearButton = styled(Button)`
  position: absolute;
  top: 50%;
  height: 16px;
  transform: translateY(-50%);
  right: 10px;
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.gray200};

  &:hover {
    color: ${p => p.theme.gray300};
  }
`;

export default SearchBar;
