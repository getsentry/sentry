import React from 'react';
import PropTypes from 'prop-types';
import ReactSelect, {Async} from 'react-select';
import styled from 'react-emotion';

export default class SelectControl extends React.Component {
  static propTypes = {
    async: PropTypes.bool,
  };

  renderArrow = () => {
    return <span className="icon-arrow-down" />;
  };

  render() {
    let {async, ...props} = this.props;

    return <StyledSelect arrowRenderer={this.renderArrow} async={async} {...props} />;
  }
}

// We're making this class because we pass `innerRef` from `FormField`
// And react yells at us if this picker is a stateless function component
// (since you can't attach refs to them)
class SelectPicker extends React.Component {
  static propTypes = {
    async: PropTypes.bool,
  };

  render() {
    let {async, ...props} = this.props;

    if (async) {
      return <Async {...props} />;
    }

    return <ReactSelect {...props} />;
  }
}

const StyledSelect = styled(SelectPicker)`
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
