import * as React from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import DropdownControl from 'app/components/dropdownControl';

import DropDownButton from './dropdownButton';
import OptionsGroup from './optionsGroup';
import {OptionType, OptionLevel, Option} from './types';

type OnClick = React.ComponentProps<typeof OptionsGroup>['onClick'];
type Options = [Array<OptionType>, Array<OptionLevel>];

type Props = {
  options: Options;
  onFilter: (options: Options) => void;
};

type State = {
  hasTypeOption: boolean;
  hasLevelOption: boolean;
  checkedQuantity: number;
};

class Filter extends React.Component<Props, State> {
  state: State = {
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

  filterOptionsFirstStep = <T extends Option>(
    options: Array<T>,
    filterOption: T
  ): Array<T> => {
    return options.map(option => {
      if (isEqual(option, filterOption)) {
        return {
          ...option,
          isChecked: !option.isChecked,
        };
      }
      return option;
    });
  };

  handleClick = (...args: Parameters<OnClick>) => {
    const [type, option] = args;
    const {onFilter, options} = this.props;

    if (type === 'type') {
      const filteredTypes = this.filterOptionsFirstStep(options[0], option);
      onFilter([filteredTypes, options[1]] as Options);
      return;
    }

    const filteredLevels = this.filterOptionsFirstStep(options[1], option);
    onFilter([options[0], filteredLevels] as Options);
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
