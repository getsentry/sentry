import React from 'react';
import styled from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';
import Input from 'app/components/forms/input';

type Props = {
  value: string;
  onChange: ({target: {value: string}}) => void;
  placeholder: string;
  smaller?: boolean;
};

class SearchInput extends React.Component<Props> {
  handleResetInput = () => {
    this.props.onChange({target: {value: ''}});
  };

  render() {
    const {placeholder, value, onChange, smaller} = this.props;
    return (
      <SearchWrapper>
        <SearchIcon smaller={smaller} />
        <SearchField
          placeholder={placeholder}
          value={value || ''}
          onChange={onChange}
          smaller={smaller}
        />
        {value && value.length > 0 && (
          <a onClick={this.handleResetInput}>
            <SearchReset smaller={smaller} />
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
const SearchIcon = styled(props => <InlineSvg src="icon-search" {...props} />)<
  Partial<Props>
>`
  color: ${p => p.theme.gray2};
  position: absolute;
  z-index: 1;
  left: 8px;
  top: ${p => (p.smaller ? '7px' : '11px')};
`;
const SearchField = styled(Input)<Partial<Props>>`
  padding-left: 30px;
  padding-right: 30px;
  height: ${p => (p.smaller ? '28px' : 'auto')};
`;
const SearchReset = styled(props => <InlineSvg src="icon-circle-close" {...props} />)<
  Partial<Props>
>`
  color: ${p => p.theme.gray2};
  position: absolute;
  z-index: 1;
  right: 8px;
  top: ${p => (p.smaller ? '6px' : '10px')};
  opacity: 0.5;
  transition: opacity 0.3s ease-in-out;

  &:hover {
    opacity: 1;
  }
`;

export default SearchInput;
