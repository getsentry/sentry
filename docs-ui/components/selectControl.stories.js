import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {action} from '@storybook/addon-actions';

import SelectControl from 'app/components/forms/selectControl';

class MySelect extends React.Component {
  select = React.createRef();
  render() {
    const options = [
      {value: 1, label: 'a'},
      {value: 2, label: 'b'},
      {value: 3, label: 'c'},
      {value: 4, label: 'd'},
    ];

    return (
      <SelectControl
        ref={this.select}
        onMenuOpen={() => {
          if (this.select.current) {
            // See https://github.com/JedWatson/react-select/issues/3648
            setTimeout(() => {
              const selectRef = this.select;
              const option = options[2];
              const selectedIndex = selectRef.current.select.state.menuOptions.focusable.indexOf(
                option
              );
              if (selectedIndex >= 0) {
                // Focusing selected option only if it exists
                selectRef.current.select.scrollToFocusedOptionOnUpdate = true;
                selectRef.current.select.inputIsHiddenAfterUpdate = false;
                selectRef.current.select.setState({
                  focusedValue: null,
                  focusedOption: option,
                });
              }
            });
          }
        }}
        options={options}
      />
    );
  }
}
// eslint-disable-next-line
storiesOf('Forms|Controls', module).add(
  'SelectControl',
  withInfo({
    text: 'Select Control',
  })(() => <MySelect />)
);
