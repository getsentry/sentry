import React from 'react';
import styled from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';
import Input from 'app/components/forms/input';

type Props = {
  value: string;
  onChange: ({target: {value: string}}) => void;
  placeholder: string;
};

class SearchInput extends React.Component<Props> {
  handleResetInput = () => {
    this.props.onChange({target: {value: ''}});
  };

  render() {
    const {placeholder, value, onChange} = this.props;
    return (
      <SearchWrapper>
        <SearchIcon />
        <SearchField placeholder={placeholder} value={value || ''} onChange={onChange} />
        {value && value.length > 0 && (
          <a onClick={this.handleResetInput}>
            <SearchReset />
          </a>
        )}
      </SearchWrapper>
    );
  }
}

const SearchWrapper = styled('div')`
  position: relative;
  display: inline-block;
`;
const SearchIcon = styled(props => <InlineSvg src="icon-search" {...props} />)`
  color: ${p => p.theme.gray2};
  position: absolute;
  z-index: 1;
  left: 8px;
  top: 11px;
`;
const SearchField = styled(Input)`
  padding-left: 29px;
  padding-right: 30px;
`;
const SearchReset = styled(props => <InlineSvg src="icon-circle-close" {...props} />)`
  color: ${p => p.theme.gray2};
  position: absolute;
  z-index: 1;
  right: 8px;
  top: 10px;
  opacity: 0.5;
  transition: opacity 0.3s ease-in-out;

  &:hover {
    opacity: 1;
  }
`;

export default SearchInput;
