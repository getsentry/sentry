import React from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import DropdownControl from 'app/components/dropdownControl';

import DropDownButton from './dropdownButton';
import OptionsGroup from './optionsGroup';
import Header from './header';
import {OptionType, OptionLevel, Option} from './types';

type OnClick = React.ComponentProps<typeof OptionsGroup>['onClick'];
type Options = [Array<OptionType>, Array<OptionLevel>];

type Props = {
  options: Options;
  onFilter: (options: Options) => void;
  onCheckAll: (checkAll: boolean) => void;
};

type State = {
  checkAll: boolean;
  hasTypeOption: boolean;
  hasLevelOption: boolean;
  checkedQuantity: number;
};

class Filter extends React.Component<Props, State> {
  state: State = {
    checkAll: true,
    hasTypeOption: false,
    hasLevelOption: false,
    checkedQuantity: this.props.options.length,
  };

  componentDidMount() {
    this.updateState();
  }

  componentDidUpdate(prevProps: Props) {
    if (!isEqual(prevProps.options, this.props.options)) {
      this.updateState();
    }
  }

  updateState = () => {
    const {options} = this.props;
    this.setState({
      hasTypeOption: options[0].length > 0,
      hasLevelOption: options[1].length > 0,
      checkedQuantity: this.getCheckedQuantity(),
    });
  };

  handleToggleCheckAll = () => {
    const {onCheckAll} = this.props;

    this.setState(
      prevState => ({
        checkAll: !prevState.checkAll,
      }),
      () => {
        onCheckAll(this.state.checkAll);
      }
    );
  };

  getCheckedQuantity = () => {
    const {options} = this.props;

    let checkedQuantity = 0;

    for (const index in options) {
      for (const option in options[index]) {
        if (options[index][option].isChecked) {
          checkedQuantity += 1;
        }
      }
    }

    return checkedQuantity;
  };

  filterOptionsFirstStep = (options: Array<Option>, option: Option) => {
    const filteredOptions = options.map(type => {
      if (isEqual(type, option)) {
        return {
          ...type,
          isChecked: !type.isChecked,
        };
      }
      return type;
    });

    const checkedOptions = filteredOptions.filter(t => t.isChecked);

    return [filteredOptions, checkedOptions];
  };

  filterOptionsByLevel = (options: Options, option: Option): Options => {
    // Filter levels
    const [levels, checkedLevels] = this.filterOptionsFirstStep(options[1], option) as [
      Options[1],
      Options[1]
    ];

    // Filter types
    const types = options[0].map(type => {
      if (
        !type.levels.some(level =>
          checkedLevels.some(checkedLevel => checkedLevel.type === level)
        )
      ) {
        const isAllLevelsWithTypeDisabled = levels
          .filter(l => type.levels.includes(l.type))
          .every(l => l.isDisabled);

        return {
          ...type,
          isDisabled: !isAllLevelsWithTypeDisabled,
        };
      }
      return {
        ...type,
        isDisabled: false,
      };
    });

    return [types, levels];
  };

  filterOptionsByType = (options: Options, option: Option): Options => {
    // Filter types
    const [types, checkedTypes] = this.filterOptionsFirstStep(options[0], option) as [
      Options[0],
      Options[0]
    ];

    // Filter levels
    const levels = options[1].map(level => {
      if (!checkedTypes.some(type => type.levels.includes(level.type))) {
        const isAllTypesWithLevelDisabled = types
          .filter(t => t.levels.includes(level.type))
          .every(t => t.isDisabled);
        return {
          ...level,
          isDisabled: !isAllTypesWithLevelDisabled,
        };
      }
      return {
        ...level,
        isDisabled: false,
      };
    });

    return [types, levels];
  };

  handleClick = (...args: Parameters<OnClick>) => {
    const [type, option] = args;
    const {onFilter, options} = this.props;

    const updatedOptions =
      type === 'type'
        ? this.filterOptionsByType(options, option)
        : this.filterOptionsByLevel(options, option);

    onFilter(updatedOptions);
  };

  render() {
    const {options} = this.props;
    const {hasTypeOption, hasLevelOption, checkedQuantity} = this.state;

    if (!hasTypeOption && !hasLevelOption) {
      return null;
    }

    return (
      <Wrapper>
        <DropdownControl
          menuWidth="240px"
          blendWithActor
          button={({isOpen, getActorProps}) => (
            <DropDownButton
              isOpen={isOpen}
              getActorProps={getActorProps}
              checkedQuantity={checkedQuantity}
            />
          )}
        >
          <Header
            onCheckAll={this.handleToggleCheckAll}
            checkedQuantity={checkedQuantity}
            isAllChecked={false}
          />
          {hasTypeOption && (
            <OptionsGroup type="type" onClick={this.handleClick} options={options[0]} />
          )}

          {hasLevelOption && (
            <OptionsGroup type="level" onClick={this.handleClick} options={options[1]} />
          )}
        </DropdownControl>
      </Wrapper>
    );
  }
}

export default Filter;

const Wrapper = styled('div')`
  position: relative;
  display: flex;
`;
