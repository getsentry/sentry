import React from 'react';
import styled from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';
import Input from 'app/components/forms/input';
import space from 'app/styles/space';

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
      <SearchWrapper smaller={!!smaller}>
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

const SearchIcon = styled(props => <InlineSvg src="icon-search" {...props} />)`
  color: ${p => p.theme.gray2};
  position: absolute;
  z-index: 1;
  left: 8px;
`;
const SearchField = styled(Input)`
  padding-left: ${space(4)};
  padding-right: ${space(4)};
`;
const SearchReset = styled(props => <InlineSvg src="icon-circle-close" {...props} />)`
  color: ${p => p.theme.gray2};
  position: absolute;
  z-index: 1;
  right: 8px;
  opacity: 0.5;
  transition: opacity 0.3s ease-in-out;

  &:hover {
    opacity: 1;
  }
`;

const SearchWrapper = styled('div')<{smaller: boolean}>`
  position: relative;
  display: inline-block;
  ${SearchIcon} {
    top: ${p => (p.smaller ? '7px' : '11px')};
  }
  ${SearchField} {
    height: ${p => (p.smaller ? '28px' : 'auto')};
  }
  ${SearchReset} {
    top: ${p => (p.smaller ? '6px' : '10px')};
  }
`;

export default SearchInput;
