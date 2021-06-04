import {mountWithTheme} from 'sentry-test/enzyme';

import DropdownFilter from 'app/components/dropdownFilter';

function toggleDropdown(wrapper) {
  wrapper.find('DropdownButton').simulate('click');
}

describe('TeamKeyTransaction', function () {
  const options = [
    {value: 'a', label: 'option A'},
    {value: 'b', label: 'option B'},
    {value: 'c', label: 'option C'},
  ];
  let onSelectionChange;

  beforeEach(function () {
    onSelectionChange = jest.fn();
  });

  it('renders basic header and options correctly', function () {
    const wrapper = mountWithTheme(
      <DropdownFilter
        alignContent="left"
        contentWidth="200px"
        menuWidth="200px"
        headerLabel="header label"
        selection={new Set()}
        options={options}
      />
    );

    expect(wrapper.find('DropdownControl').exists()).toBeTruthy();
    expect(wrapper.find('DropdownButton').exists()).toBeTruthy();

    // The search input is not enabled by default
    expect(wrapper.find('Input').exists()).toBeFalsy();

    toggleDropdown(wrapper);

    expect(wrapper.find('Header span').text()).toEqual('header label');
    expect(wrapper.find('Header CheckboxFancy').props().isChecked).toBeFalsy();
    expect(wrapper.find('Header CheckboxFancy').props().isIndeterminate).toBeFalsy();

    wrapper.find('List ListItem').forEach((item, i) => {
      expect(item.text()).toEqual(options[i].label);
      expect(item.props().isChecked).toBeFalsy();
    });
  });

  it('can fires the onSelectionChange callback when selecting', function () {
    const wrapper = mountWithTheme(
      <DropdownFilter
        alignContent="left"
        contentWidth="200px"
        menuWidth="200px"
        headerLabel="header label"
        selection={new Set()}
        options={options}
        onSelectionChange={onSelectionChange}
      />
    );

    expect(wrapper.find('DropdownControl').exists()).toBeTruthy();
    expect(wrapper.find('DropdownButton').exists()).toBeTruthy();

    // The search input is not enabled by default
    expect(wrapper.find('Input').exists()).toBeFalsy();

    toggleDropdown(wrapper);

    wrapper.find('Header CheckboxFancy').simulate('click');
    expect(onSelectionChange).toHaveBeenCalledWith(
      new Set(options.map(({value}) => value))
    );
    onSelectionChange.mockClear();

    for (let i = 0; i < options.length; i++) {
      wrapper.find('List ListItem').at(i).simulate('click');
      expect(onSelectionChange).toHaveBeenCalledWith(new Set([options[i].value]));
      onSelectionChange.mockClear();
    }
  });

  it('can fires the onSelectionChange callback when unselecting', function () {
    const wrapper = mountWithTheme(
      <DropdownFilter
        alignContent="left"
        contentWidth="200px"
        menuWidth="200px"
        headerLabel="header label"
        selection={new Set(options.map(({value}) => value))}
        options={options}
        onSelectionChange={onSelectionChange}
      />
    );

    toggleDropdown(wrapper);

    wrapper.find('Header CheckboxFancy').simulate('click');
    expect(onSelectionChange).toHaveBeenCalledWith(new Set());
    onSelectionChange.mockClear();

    for (let i = 0; i < options.length; i++) {
      wrapper.find('List ListItem').at(i).simulate('click');
      expect(onSelectionChange).toHaveBeenCalledWith(
        new Set(options.filter((_option, j) => i !== j).map(({value}) => value))
      );
      onSelectionChange.mockClear();
    }
  });

  it('renders working search bar when enabled', function () {
    const wrapper = mountWithTheme(
      <DropdownFilter
        alignContent="left"
        contentWidth="200px"
        menuWidth="200px"
        headerLabel="header label"
        selection={new Set()}
        options={options}
        onSelectionChange={onSelectionChange}
        enableSearch
        searchPlaceHolder="placeholder"
      />
    );

    toggleDropdown(wrapper);

    expect(wrapper.find('Input').exists()).toBeTruthy();
    wrapper.find('Input').simulate('change', {target: {value: 'C'}});
    wrapper.update();
    expect(wrapper.find('List ListItem').length).toEqual(1);
    expect(wrapper.find('List ListItem').text()).toEqual(options[2].label);
  });
});
