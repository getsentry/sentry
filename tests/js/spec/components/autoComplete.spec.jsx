import React from 'react';
import {mount} from 'enzyme';
import AutoComplete from 'app/components/autoComplete';

const items = [
  {
    name: 'Apple',
  },
  {
    name: 'Pineapple',
  },
  {
    name: 'Orange',
  },
];

/**
 * For every render, we push all injected params into `autoCompleteState`, we probably want to
 * assert against those instead of the wrapper's state since component state will be different if we have
 * "controlled" props where <AutoComplete> does not handle state
 */
describe('AutoComplete', function() {
  let wrapper;
  let input;
  let autoCompleteState = [];
  let mocks = {
    onSelect: jest.fn(),
  };

  beforeEach(() => {
    autoCompleteState = [];
    Object.keys(mocks).forEach(key => mocks[key].mockReset());

    wrapper = mount(
      <AutoComplete {...mocks} itemToString={item => item.name}>
        {injectedProps => {
          let {
            getRootProps,
            getInputProps,
            getMenuProps,
            getItemProps,
            inputValue,
            highlightedIndex,
            isOpen,
          } = injectedProps;

          // This is purely for testing
          autoCompleteState.push(injectedProps);

          return (
            <div {...getRootProps({style: {position: 'relative'}})}>
              <input {...getInputProps({})} />

              {isOpen && (
                <div
                  {...getMenuProps({
                    style: {
                      boxShadow:
                        '0 1px 4px 1px rgba(47,40,55,0.08), 0 4px 16px 0 rgba(47,40,55,0.12)',
                      position: 'absolute',
                      backgroundColor: 'white',
                      padding: '0',
                    },
                  })}
                >
                  <ul>
                    {items
                      .filter(
                        item =>
                          item.name.toLowerCase().indexOf(inputValue.toLowerCase()) > -1
                      )
                      .map((item, index) => (
                        <li
                          key={item.name}
                          {...getItemProps({
                            item,
                            index,
                            style: {
                              cursor: 'pointer',
                              padding: '6px 12px',
                              backgroundColor:
                                index === highlightedIndex
                                  ? 'rgba(0, 0, 0, 0.02)'
                                  : undefined,
                            },
                          })}
                        >
                          {item.name}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          );
        }}
      </AutoComplete>
    );

    input = wrapper.find('input');
  });

  it('shows dropdown menu when input has focus', function() {
    input.simulate('focus');
    expect(wrapper.state('isOpen')).toBe(true);
    expect(wrapper.find('li')).toHaveLength(3);
  });

  it('hides dropdown menu when input is blurred', function() {
    jest.useFakeTimers();
    input.simulate('focus');
    input.simulate('blur');
    expect(wrapper.state('isOpen')).toBe(true);
    expect(wrapper.find('li')).toHaveLength(3);
    jest.runAllTimers();

    expect(wrapper.state('isOpen')).toBe(false);
    expect(wrapper.find('li')).toHaveLength(0);
  });

  it('can close dropdown menu when Escape is pressed', function() {
    input.simulate('focus');
    expect(wrapper.state('isOpen')).toBe(true);

    input.simulate('keyDown', {key: 'Escape'});
    expect(wrapper.state('isOpen')).toBe(false);
  });

  it('reopens dropdown menu after Escape is pressed and input is changed', function() {
    input.simulate('focus');
    expect(wrapper.state('isOpen')).toBe(true);

    input.simulate('keyDown', {key: 'Escape'});
    expect(wrapper.state('isOpen')).toBe(false);

    input.simulate('change', {target: {value: 'a'}});
    expect(wrapper.state('isOpen')).toBe(true);
    expect(wrapper.instance().items.size).toBe(3);
  });

  it('reopens dropdown menu after item is selectted and then input is changed', function() {
    input.simulate('focus');
    expect(wrapper.state('isOpen')).toBe(true);

    input.simulate('change', {target: {value: 'eapp'}});
    expect(wrapper.state('isOpen')).toBe(true);
    expect(wrapper.instance().items.size).toBe(1);
    input.simulate('keyDown', {key: 'Enter'});
    expect(wrapper.state('isOpen')).toBe(false);

    input.simulate('change', {target: {value: 'app'}});
    expect(wrapper.state('isOpen')).toBe(true);
    expect(wrapper.instance().items.size).toBe(2);
  });

  it('selects dropdown item by clicking and sets input to selected value', function() {
    input.simulate('focus');
    expect(wrapper.state('isOpen')).toBe(true);
    expect(wrapper.instance().items.size).toBe(3);

    wrapper
      .find('li')
      .at(1)
      .simulate('click');
    expect(mocks.onSelect).toHaveBeenCalledWith(items[1]);

    expect(wrapper.state('inputValue')).toBe('Pineapple');
    expect(wrapper.instance().items.size).toBe(0);
  });

  it('can navigate dropdown items with keyboard and select with "Enter" keypress', function() {
    input.simulate('focus');
    expect(wrapper.state('isOpen')).toBe(true);
    expect(wrapper.state('highlightedIndex')).toBe(0);

    input.simulate('keyDown', {key: 'ArrowDown'});
    expect(wrapper.state('highlightedIndex')).toBe(1);

    input.simulate('keyDown', {key: 'ArrowDown'});
    expect(wrapper.state('highlightedIndex')).toBe(2);

    expect(wrapper.instance().items.size).toBe(3);
    input.simulate('keyDown', {key: 'Enter'});

    expect(mocks.onSelect).toHaveBeenCalledWith(items[2]);
    expect(wrapper.instance().items.size).toBe(0);
    expect(wrapper.state('inputValue')).toBe('Orange');
  });

  it('respects list bounds when navigating filtered items with arrow keys', function() {
    input.simulate('focus');
    expect(wrapper.state('isOpen')).toBe(true);
    expect(wrapper.state('highlightedIndex')).toBe(0);

    input.simulate('keyDown', {key: 'ArrowUp'});
    expect(wrapper.state('highlightedIndex')).toBe(0);

    input.simulate('keyDown', {key: 'ArrowDown'});
    expect(wrapper.state('highlightedIndex')).toBe(1);

    input.simulate('keyDown', {key: 'ArrowDown'});
    expect(wrapper.state('highlightedIndex')).toBe(2);

    input.simulate('keyDown', {key: 'ArrowDown'});
    expect(wrapper.state('highlightedIndex')).toBe(2);

    input.simulate('keyDown', {key: 'ArrowUp'});
    expect(wrapper.state('highlightedIndex')).toBe(1);

    input.simulate('keyDown', {key: 'ArrowUp'});
    expect(wrapper.state('highlightedIndex')).toBe(0);

    input.simulate('keyDown', {key: 'ArrowUp'});
    expect(wrapper.state('highlightedIndex')).toBe(0);

    expect(wrapper.instance().items.size).toBe(3);
  });

  it('can filter items and then navigate with keyboard', function() {
    input.simulate('focus');
    expect(wrapper.state('isOpen')).toBe(true);
    expect(wrapper.state('highlightedIndex')).toBe(0);
    expect(wrapper.instance().items.size).toBe(3);

    input.simulate('change', {target: {value: 'a'}});
    expect(wrapper.state('highlightedIndex')).toBe(0);
    expect(wrapper.state('inputValue')).toBe('a');
    // Apple, pineapple, orange
    expect(wrapper.instance().items.size).toBe(3);

    input.simulate('change', {target: {value: 'ap'}});
    expect(wrapper.state('highlightedIndex')).toBe(0);
    expect(wrapper.state('inputValue')).toBe('ap');
    expect(autoCompleteState[autoCompleteState.length - 1].inputValue).toBe('ap');
    // Apple, pineapple
    expect(wrapper.instance().items.size).toBe(2);

    input.simulate('keyDown', {key: 'ArrowDown'});
    expect(wrapper.state('highlightedIndex')).toBe(1);

    input.simulate('keyDown', {key: 'ArrowDown'});
    expect(wrapper.state('highlightedIndex')).toBe(1);
    expect(wrapper.instance().items.size).toBe(2);

    input.simulate('keyDown', {key: 'Enter'});
    expect(mocks.onSelect).toHaveBeenCalledWith(items[1]);
    expect(wrapper.instance().items.size).toBe(0);
    expect(wrapper.state('inputValue')).toBe('Pineapple');
  });
});
