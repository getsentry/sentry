import React from 'react';
import ReactSelect, {Async} from 'react-select';
import styled from 'react-emotion';

const StyledSelect = styled(({async, ...props}) => {
  if (async) {
    return <Async {...props} />;
  }
  return <ReactSelect {...props} />;
})`
  font-size: 15px;

  .Select-control,
  &.Select.is-focused:not(.is-open) > .Select-control {
    overflow: visible;
    border: 1px solid ${p => p.theme.borderDark};
    box-shadow: inset ${p => p.theme.dropShadowLight};
  }
  .Select-input {
    height: 36px;
    input {
      padding: 10px 0;
    }
  }

  .Select-placeholder,
  .Select--single > .Select-control .Select-value {
    height: 36px;
    &:focus {
      border: 1px solid ${p => p.theme.gray};
    }
  }

  .Select-option.is-focused {
    color: white;
    background-color: ${p => p.theme.purple};
  }
  .Select-multi-value-wrapper {
    > a {
      margin-left: 4px;
    }
  }

  .Select.is-focused:not(.is-open) > .Select-control {
    border-color: ${p => p.theme.gray};
  }
`;

export default StyledSelect;
