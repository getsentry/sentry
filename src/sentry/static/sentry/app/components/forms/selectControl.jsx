import PropTypes from 'prop-types';
import React from 'react';
import ReactSelect, {Async, Creatable, AsyncCreatable} from 'react-select';
import styled from 'react-emotion';

import convertFromSelect2Choices from 'app/utils/convertFromSelect2Choices';

export default class SelectControl extends React.Component {
  static propTypes = {
    ...ReactSelect.propTypes,
    options: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.node,
        value: PropTypes.any,
      })
    ),
    // react-select knows this as multi, but for standardization
    // and compatibility we use multiple
    multiple: PropTypes.bool,
    // multi is supported for compatibility
    multi: PropTypes.bool,
    choices: PropTypes.oneOfType([
      PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.array])),
      PropTypes.func,
    ]),
  };

  static defaultProps = {
    clearable: false,
    multiple: false,
    height: 36,
  };

  renderArrow = () => {
    return <span className="icon-arrow-down" />;
  };

  render() {
    let {async, creatable, options, choices, clearable, ...props} = this.props;

    // Compatibility with old select2 API
    let choicesOrOptions =
      convertFromSelect2Choices(
        typeof choices === 'function' ? choices(this.props) : choices
      ) || options;

    // "-Removes" props should match `clearable` unless explicitly defined in props
    // rest props should be after "-Removes" so that it can be overridden
    return (
      <StyledSelect
        arrowRenderer={this.renderArrow}
        async={async}
        creatable={creatable}
        clearable={clearable}
        backspaceRemoves={clearable}
        deleteRemoves={clearable}
        {...props}
        multi={this.props.multiple || this.props.multi}
        options={choicesOrOptions}
      />
    );
  }
}

const SelectPicker = ({async, creatable, forwardedRef, ...props}) => {
  // Pick the right component to use
  let Component;
  if (async && creatable) {
    Component = AsyncCreatable;
  } else if (async && !creatable) {
    Component = Async;
  } else if (creatable) {
    Component = Creatable;
  } else {
    Component = ReactSelect;
  }

  return <Component ref={forwardedRef} {...props} />;
};
SelectPicker.propTypes = {
  async: PropTypes.bool,
  creatable: PropTypes.bool,
  forwardedRef: PropTypes.any,
};

const forwardRef = (props, ref) => <SelectPicker {...props} forwardedRef={ref} />;
forwardRef.displayName = 'SelectPicker';

const StyledSelect = styled(React.forwardRef(forwardRef))`
  font-size: 15px;

  .Select-control,
  &.Select.is-focused:not(.is-open) > .Select-control {
    height: ${p => p.height}px;
    overflow: visible;
    border: 1px solid ${p => p.theme.borderDark};
    box-shadow: inset ${p => p.theme.dropShadowLight};
  }
  .Select-input {
    height: ${p => p.height}px;
    input {
      line-height: ${p => p.height}px;
      padding: 0 0;
    }
  }

  .Select-placeholder,
  &.Select--single > .Select-control .Select-value {
    height: ${p => p.height}px;
    line-height: ${p => p.height}px;
    &:focus {
      border: 1px solid ${p => p.theme.gray};
    }
  }

  &.Select--single.is-disabled .Select-control .Select-value .Select-value-label {
    color: ${p => p.theme.disabled};
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
