import PropTypes from 'prop-types';
import React from 'react';
import ReactSelect, {Async} from 'react-select';
import styled from 'react-emotion';

import convertFromSelect2Choices from 'app/utils/convertFromSelect2Choices';

export default class SelectControl extends React.Component {
  static propTypes = {
    async: PropTypes.bool,
    options: PropTypes.array,
    choices: PropTypes.oneOfType([
      PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.array])),
      PropTypes.func,
    ]),
  };

  renderArrow = () => {
    return <span className="icon-arrow-down" />;
  };

  render() {
    let {async, options, choices, ...props} = this.props;

    // Compatibility with old select2 API
    let choicesOrOptions =
      convertFromSelect2Choices(
        typeof choices === 'function' ? choices(this.props) : choices
      ) || options;

    return (
      <StyledSelect
        arrowRenderer={this.renderArrow}
        async={async}
        {...props}
        options={choicesOrOptions}
      />
    );
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
