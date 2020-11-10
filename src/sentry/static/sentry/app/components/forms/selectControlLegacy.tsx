import PropTypes from 'prop-types';
import React from 'react';
import ReactSelect, {Async, Creatable, AsyncCreatable} from 'react-select-legacy';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {IconChevron} from 'app/icons';
import convertFromSelect2Choices from 'app/utils/convertFromSelect2Choices';
import space from 'app/styles/space';
import {callIfFunction} from 'app/utils/callIfFunction';

/**
 * The library has `value` defined as `PropTypes.object`, but this
 * is not the case when `multiple` is true :/
 */
ReactSelect.Value.propTypes = {
  ...ReactSelect.Value.propTypes,
  value: PropTypes.any,
};

type Option = {
  label: React.ReactNode;
  value: any;
};

type Props = {
  options: Option[];
  multiple?: boolean;
  multi?: boolean;
  noMenu?: boolean;
  choices?: Function | Array<string | any[]>;
  placeholder?: string;

  clearable: boolean;
  height: number;

  async: boolean;
  creatable: boolean;
  forwardedRef: React.Ref<HTMLInputElement>;
};

class SelectControlLegacy extends React.Component<Props> {
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
    // disable rendering a menu
    noMenu: PropTypes.bool,
    choices: PropTypes.oneOfType([
      PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.array])),
      PropTypes.func,
    ]),
    placeholder: PropTypes.oneOfType([ReactSelect.propTypes.placeholder, PropTypes.func]),
  };

  static defaultProps = {
    clearable: false,
    multiple: false,
    height: 36,
  };

  renderArrow = () => <StyledIconChevron direction="down" size="xs" />;

  render() {
    const {
      async,
      creatable,
      options,
      choices,
      clearable,
      noMenu,
      placeholder,
      ...props
    } = this.props;

    // Compatibility with old select2 API
    const choicesOrOptions =
      convertFromSelect2Choices(
        typeof choices === 'function' ? choices(this.props) : choices
      ) || options;

    const noMenuProps = {
      arrowRenderer: () => null,
      menuRenderer: () => null,
      openOnClick: false,
      menuContainerStyle: {display: 'none'},
    };

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
        noMenu={noMenu}
        {...(noMenu ? noMenuProps : {})}
        {...props}
        multi={this.props.multiple || this.props.multi}
        options={choicesOrOptions}
        placeholder={callIfFunction(placeholder, this.props) || placeholder}
      />
    );
  }
}

type SelectPickerProps = {
  arrowRenderer: () => JSX.Element | null;
  backspaceRemoves: boolean;
  deleteRemoves: boolean;
} & Props;

const SelectPicker = ({async, creatable, forwardedRef, ...props}: SelectPickerProps) => {
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

const StyledSelect = styled(SelectPicker)`
  font-size: 15px;

  .Select-control {
    border: 1px solid ${p => p.theme.border};
    height: ${p => p.height}px;
    overflow: visible;
  }

  &.Select.is-focused > .Select-control {
    border: 1px solid ${p => p.theme.border};
    border-color: ${p => p.theme.gray700};
    box-shadow: rgba(209, 202, 216, 0.5) 0 0 0 3px;
  }

  &.Select.is-focused:not(.is-open) > .Select-control {
    height: ${p => p.height}px;
    overflow: visible;
  }

  .Select-input {
    height: ${p => p.height}px;
    input {
      line-height: ${p => p.height}px;
      padding: 0 0;
    }
  }

  &.Select--multi .Select-value {
    margin-top: 6px;
  }

  .Select-placeholder,
  &.Select--single > .Select-control .Select-value {
    height: ${p => p.height}px;
    line-height: ${p => p.height}px;
    &:focus {
      border: 1px solid ${p => p.theme.gray700};
    }
  }

  &.Select--single.is-disabled .Select-control .Select-value .Select-value-label {
    color: ${p => p.theme.disabled};
  }

  .Select-option.is-focused {
    color: white;
    background-color: ${p => p.theme.purple300};
  }
  .Select-multi-value-wrapper {
    > a {
      margin-left: 4px;
    }
  }

  .Select-clear {
    vertical-align: middle;
  }

  .Select-menu-outer {
    z-index: ${p => p.theme.zIndex.dropdown};
  }

  ${({noMenu}) =>
    noMenu &&
    css`
      &.Select.is-focused.is-open > .Select-control {
        border-radius: 4px;
      }
    `}
`;

const StyledIconChevron = styled(IconChevron)`
  margin-top: ${space(0.5)};
`;

export default SelectControlLegacy;
