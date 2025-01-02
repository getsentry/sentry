import {useEffect} from 'react';

import {act, fireEvent, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import type {AutoCompleteProps} from 'sentry/components/autoComplete';
import AutoComplete from 'sentry/components/autoComplete';

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
describe('AutoComplete', function () {
  let input: HTMLInputElement;
  let autoCompleteState: any[] = [];
  const mocks = {
    onSelect: jest.fn(),
    onClose: jest.fn(),
    onOpen: jest.fn(),
  };

  afterEach(() => {
    jest.resetAllMocks();
    autoCompleteState = [];
  });

  function List({
    registerItemCount,
    itemCount,
    ...props
  }: {
    children: React.ReactNode;
    itemCount: number;
    registerItemCount: (count?: number) => void;
  }) {
    useEffect(() => void registerItemCount(itemCount), [itemCount, registerItemCount]);
    return <ul {...props} />;
  }

  function Item({
    registerVisibleItem,
    item,
    index,
    ...props
  }: {
    children: React.ReactNode;
    index: number;
    item: {name?: string};
    registerVisibleItem: (index: number, item: any) => () => void;
  }) {
    useEffect(() => registerVisibleItem(index, item), [registerVisibleItem, index, item]);
    return <li {...props} />;
  }

  const createComponent = (props: Partial<AutoCompleteProps<any>>) => (
    <AutoComplete {...mocks} itemToString={item => item.name} {...props}>
      {injectedProps => {
        const {
          getRootProps,
          getInputProps,
          getMenuProps,
          getItemProps,
          inputValue,
          isOpen,
          registerItemCount,
          registerVisibleItem,
          highlightedIndex,
        } = injectedProps;

        // This is purely for testing
        autoCompleteState.push(injectedProps);

        const filteredItems = items.filter(item =>
          item.name.toLowerCase().includes(inputValue.toLowerCase())
        );

        return (
          <div {...getRootProps()}>
            <input placeholder="autocomplete" {...getInputProps({})} />

            {isOpen && (
              <div {...getMenuProps()} data-test-id="test-autocomplete">
                <List
                  registerItemCount={registerItemCount}
                  itemCount={filteredItems.length}
                >
                  {filteredItems.map((item, index) => (
                    <Item
                      key={item.name}
                      registerVisibleItem={registerVisibleItem}
                      index={index}
                      item={item}
                      aria-selected={highlightedIndex === index}
                      {...getItemProps({item, index})}
                    >
                      {item.name}
                    </Item>
                  ))}
                </List>
              </div>
            )}
          </div>
        );
      }}
    </AutoComplete>
  );

  const createWrapper = (props?: any) => {
    const wrapper = render(createComponent(props));
    input = screen.getByPlaceholderText('autocomplete');
    return wrapper;
  };

  describe('Uncontrolled', function () {
    it('shows dropdown menu when input has focus', function () {
      createWrapper();
      fireEvent.focus(input);
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();
      for (const item of items) {
        expect(screen.getByText(item.name)).toBeInTheDocument();
      }
    });

    it('only tries to close once if input is blurred and click outside occurs', async function () {
      createWrapper();
      jest.useFakeTimers();
      fireEvent.focus(input);
      fireEvent.blur(input);
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();
      // Click outside dropdown
      fireEvent.click(document.body);
      jest.runAllTimers();

      await waitFor(() => expect(mocks.onClose).toHaveBeenCalledTimes(1));
    });

    it('only calls onClose dropdown menu when input is blurred', function () {
      createWrapper();
      jest.useFakeTimers();
      fireEvent.focus(input);
      fireEvent.blur(input);
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();
      act(() => jest.runAllTimers());

      expect(screen.queryByTestId('test-autocomplete')).not.toBeInTheDocument();
      expect(mocks.onClose).toHaveBeenCalledTimes(1);
    });

    it('can close dropdown menu when Escape is pressed', function () {
      createWrapper();
      fireEvent.focus(input);
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      fireEvent.keyDown(input, {key: 'Escape', charCode: 27});
      expect(screen.queryByTestId('test-autocomplete')).not.toBeInTheDocument();
    });

    it('can open and close dropdown menu using injected actions', function () {
      createWrapper();
      const [injectedProps] = autoCompleteState;
      act(() => injectedProps.actions.open());
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();
      expect(mocks.onOpen).toHaveBeenCalledTimes(1);

      act(() => injectedProps.actions.close());
      expect(screen.queryByTestId('test-autocomplete')).not.toBeInTheDocument();
      expect(mocks.onClose).toHaveBeenCalledTimes(1);
    });

    it('reopens dropdown menu after Escape is pressed and input is changed', function () {
      createWrapper();
      fireEvent.focus(input);
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      fireEvent.keyDown(input, {key: 'Escape', charCode: 27});
      expect(screen.queryByTestId('test-autocomplete')).not.toBeInTheDocument();

      fireEvent.change(input, {target: {value: 'a', charCode: 65}});
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();
      expect(screen.getAllByRole('option')).toHaveLength(3);
    });

    it('reopens dropdown menu after item is selected and then input is changed', function () {
      createWrapper();
      fireEvent.focus(input);
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      fireEvent.change(input, {target: {value: 'eapp'}});
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      expect(screen.getByRole('option')).toBeInTheDocument();
      fireEvent.keyDown(input, {key: 'Enter', charCode: 13});
      expect(screen.queryByTestId('test-autocomplete')).not.toBeInTheDocument();

      fireEvent.change(input, {target: {value: 'app'}});
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      expect(screen.getAllByRole('option')).toHaveLength(2);
    });

    it('selects dropdown item by clicking and sets input to selected value', function () {
      createWrapper();
      fireEvent.focus(input);
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();
      expect(screen.getAllByRole('option')).toHaveLength(3);

      fireEvent.click(screen.getByText(items[1]!.name));
      expect(mocks.onSelect).toHaveBeenCalledWith(
        items[1],
        expect.objectContaining({inputValue: '', highlightedIndex: 0}),
        expect.anything()
      );

      expect(input).toHaveValue('Pineapple');
      expect(screen.queryByRole('option')).not.toBeInTheDocument();
    });

    it('can navigate dropdown items with keyboard and select with "Enter" keypress', function () {
      createWrapper();
      fireEvent.focus(input);
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();
      expect(screen.getByText('Apple')).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(input, {key: 'ArrowDown', charCode: 40});
      expect(screen.getByText('Pineapple')).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(input, {key: 'ArrowDown', charCode: 40});
      expect(screen.getByText('Orange')).toHaveAttribute('aria-selected', 'true');

      expect(screen.getAllByRole('option')).toHaveLength(3);
      fireEvent.keyDown(input, {key: 'Enter', charCode: 13});

      expect(mocks.onSelect).toHaveBeenCalledWith(
        items[2],
        expect.objectContaining({inputValue: '', highlightedIndex: 2}),
        expect.anything()
      );
      expect(screen.queryByRole('option')).not.toBeInTheDocument();
      expect(input).toHaveValue('Orange');
    });

    it('respects list bounds when navigating filtered items with arrow keys', function () {
      createWrapper();
      fireEvent.focus(input);
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();
      expect(screen.getByText('Apple')).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(input, {key: 'ArrowUp', charCode: 38});
      expect(screen.getByText('Apple')).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(input, {key: 'ArrowDown', charCode: 40});
      expect(screen.getByText('Pineapple')).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(input, {key: 'ArrowDown', charCode: 40});
      expect(screen.getByText('Orange')).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(input, {key: 'ArrowDown', charCode: 40});
      expect(screen.getByText('Orange')).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(input, {key: 'ArrowUp', charCode: 38});
      expect(screen.getByText('Pineapple')).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(input, {key: 'ArrowUp', charCode: 38});
      expect(screen.getByText('Apple')).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(input, {key: 'ArrowUp', charCode: 38});
      expect(screen.getByText('Apple')).toHaveAttribute('aria-selected', 'true');

      expect(screen.getAllByRole('option')).toHaveLength(3);
    });

    it('can filter items and then navigate with keyboard', function () {
      createWrapper();
      fireEvent.focus(input);
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();
      expect(screen.getByText('Apple')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getAllByRole('option')).toHaveLength(3);

      fireEvent.keyDown(input, {target: {value: 'a', charCode: 65}});
      expect(screen.getByText('Apple')).toHaveAttribute('aria-selected', 'true');
      expect(input).toHaveValue('a');
      // Apple, pineapple, orange
      expect(screen.getAllByRole('option')).toHaveLength(3);

      fireEvent.change(input, {target: {value: 'ap'}});
      expect(screen.getByText('Apple')).toHaveAttribute('aria-selected', 'true');
      expect(input).toHaveValue('ap');
      expect(autoCompleteState[autoCompleteState.length - 1].inputValue).toBe('ap');
      // Apple, pineapple
      expect(screen.getAllByRole('option')).toHaveLength(2);

      fireEvent.keyDown(input, {key: 'ArrowDown', charCode: 40});
      expect(screen.getByText('Pineapple')).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(input, {key: 'ArrowDown', charCode: 40});
      expect(screen.getByText('Pineapple')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getAllByRole('option')).toHaveLength(2);

      fireEvent.keyDown(input, {key: 'Enter', charCode: 13});
      expect(mocks.onSelect).toHaveBeenCalledWith(
        items[1],
        expect.objectContaining({inputValue: 'ap', highlightedIndex: 1}),
        expect.anything()
      );
      expect(screen.queryByRole('option')).not.toBeInTheDocument();
      expect(input).toHaveValue('Pineapple');
    });

    it('can reset input when menu closes', function () {
      const wrapper = createWrapper();
      jest.useFakeTimers();
      wrapper.rerender(createComponent({resetInputOnClose: true}));
      fireEvent.focus(input);
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      fireEvent.keyDown(input, {target: {value: 'a', charCode: 65}});
      expect(input).toHaveValue('a');

      fireEvent.blur(input);
      act(() => jest.runAllTimers());
      expect(screen.queryByTestId('test-autocomplete')).not.toBeInTheDocument();
      expect(input).toHaveValue('');
    });
  });

  describe('isOpen controlled', function () {
    it('has dropdown menu initially open', function () {
      createWrapper({isOpen: true});
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();
      expect(screen.getAllByRole('option')).toHaveLength(3);
    });

    it('closes when props change', function () {
      const wrapper = createWrapper({isOpen: true});
      wrapper.rerender(createComponent({isOpen: false}));

      // Menu should be closed
      expect(screen.queryByTestId('test-autocomplete')).not.toBeInTheDocument();
      expect(screen.queryByRole('option')).not.toBeInTheDocument();
    });

    it('remains closed when input is focused, but calls `onOpen`', function () {
      createWrapper({isOpen: false});
      jest.useFakeTimers();

      expect(screen.queryByTestId('test-autocomplete')).not.toBeInTheDocument();

      fireEvent.focus(input);
      jest.runAllTimers();
      expect(screen.queryByTestId('test-autocomplete')).not.toBeInTheDocument();
      expect(screen.queryByRole('option')).not.toBeInTheDocument();

      expect(mocks.onOpen).toHaveBeenCalledTimes(1);
    });

    it('remains open when input focus/blur events occur, but calls `onClose`', function () {
      createWrapper({isOpen: true});
      jest.useFakeTimers();
      fireEvent.focus(input);
      fireEvent.blur(input);
      act(() => jest.runAllTimers());
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      // This still gets called even though menu is open
      expect(mocks.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape is pressed', function () {
      createWrapper({isOpen: true});
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      fireEvent.keyDown(input, {key: 'Escape', charCode: 27});
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      expect(mocks.onClose).toHaveBeenCalledTimes(1);
    });

    it('does not open and close dropdown menu using injected actions', function () {
      createWrapper({isOpen: true});
      const [injectedProps] = autoCompleteState;
      act(() => injectedProps.actions.open());
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      expect(mocks.onOpen).toHaveBeenCalledTimes(1);

      act(() => injectedProps.actions.close());
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      expect(mocks.onClose).toHaveBeenCalledTimes(1);
    });

    it('onClose is called after item is selected', function () {
      createWrapper({isOpen: true});
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      fireEvent.change(input, {target: {value: 'eapp'}});
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      expect(screen.getByRole('option')).toBeInTheDocument();
      fireEvent.keyDown(input, {key: 'Enter', charCode: 13});
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      expect(mocks.onClose).toHaveBeenCalledTimes(1);
    });

    it('selects dropdown item by clicking and sets input to selected value', function () {
      createWrapper({isOpen: true});
      expect(screen.getAllByRole('option')).toHaveLength(3);

      fireEvent.click(screen.getByText(items[1]!.name));
      expect(mocks.onSelect).toHaveBeenCalledWith(
        items[1],
        expect.objectContaining({inputValue: '', highlightedIndex: 0}),
        expect.anything()
      );

      expect(input).toHaveValue('Pineapple');
      expect(mocks.onClose).toHaveBeenCalledTimes(1);
    });

    it('can navigate dropdown items with keyboard and select with "Enter" keypress', function () {
      createWrapper({isOpen: true});
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      expect(screen.getByText('Apple')).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(input, {key: 'ArrowDown', charCode: 40});
      expect(screen.getByText('Pineapple')).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(input, {key: 'ArrowDown', charCode: 40});
      expect(screen.getByText('Orange')).toHaveAttribute('aria-selected', 'true');

      expect(screen.getAllByRole('option')).toHaveLength(3);
      fireEvent.keyDown(input, {key: 'Enter', charCode: 13});

      expect(mocks.onSelect).toHaveBeenCalledWith(
        items[2],
        expect.objectContaining({inputValue: '', highlightedIndex: 2}),
        expect.anything()
      );
      expect(mocks.onClose).toHaveBeenCalledTimes(1);
      expect(input).toHaveValue('Orange');
    });

    it('respects list bounds when navigating filtered items with arrow keys', function () {
      createWrapper({isOpen: true});
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      expect(screen.getByText('Apple')).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(input, {key: 'ArrowUp', charCode: 38});
      expect(screen.getByText('Apple')).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(input, {key: 'ArrowDown', charCode: 40});
      expect(screen.getByText('Pineapple')).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(input, {key: 'ArrowDown', charCode: 40});
      expect(screen.getByText('Orange')).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(input, {key: 'ArrowDown', charCode: 40});
      expect(screen.getByText('Orange')).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(input, {key: 'ArrowUp', charCode: 38});
      expect(screen.getByText('Pineapple')).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(input, {key: 'ArrowUp', charCode: 38});
      expect(screen.getByText('Apple')).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(input, {key: 'ArrowUp', charCode: 38});
      expect(screen.getByText('Apple')).toHaveAttribute('aria-selected', 'true');

      expect(screen.getAllByRole('option')).toHaveLength(3);
    });

    it('can filter items and then navigate with keyboard', function () {
      createWrapper({isOpen: true});
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      expect(screen.getByText('Apple')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getAllByRole('option')).toHaveLength(3);

      fireEvent.keyDown(input, {target: {value: 'a', charCode: 65}});
      expect(screen.getByText('Apple')).toHaveAttribute('aria-selected', 'true');
      expect(input).toHaveValue('a');
      // Apple, pineapple, orange
      expect(screen.getAllByRole('option')).toHaveLength(3);

      fireEvent.change(input, {target: {value: 'ap'}});
      expect(screen.getByText('Apple')).toHaveAttribute('aria-selected', 'true');
      expect(input).toHaveValue('ap');
      expect(autoCompleteState[autoCompleteState.length - 1].inputValue).toBe('ap');
      // Apple, pineapple
      expect(screen.getAllByRole('option')).toHaveLength(2);

      fireEvent.keyDown(input, {key: 'ArrowDown', charCode: 40});
      expect(screen.getByText('Pineapple')).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(input, {key: 'ArrowDown', charCode: 40});
      expect(screen.getByText('Pineapple')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getAllByRole('option')).toHaveLength(2);

      fireEvent.keyDown(input, {key: 'Enter', charCode: 13});
      expect(mocks.onSelect).toHaveBeenCalledWith(
        items[1],
        expect.objectContaining({inputValue: 'ap', highlightedIndex: 1}),
        expect.anything()
      );
      expect(mocks.onClose).toHaveBeenCalledTimes(1);
      expect(input).toHaveValue('Pineapple');
    });

    it('only scrolls highlighted item into view on keyboard events', function () {
      const scrollIntoViewMock = jest.fn();
      Element.prototype.scrollIntoView = scrollIntoViewMock;

      createWrapper({isOpen: true});
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      fireEvent.mouseEnter(screen.getByText('Pineapple'));
      expect(scrollIntoViewMock).not.toHaveBeenCalled();

      fireEvent.keyDown(input, {key: 'ArrowDown', charCode: 40});
      expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    });

    it('can reset input value when menu closes', function () {
      const wrapper = createWrapper({isOpen: true});
      jest.useFakeTimers();
      wrapper.rerender(createComponent({resetInputOnClose: true}));
      fireEvent.focus(input);
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      fireEvent.keyDown(input, {target: {value: 'a', charCode: 65}});
      expect(input).toHaveValue('a');

      fireEvent.blur(input);
      act(() => jest.runAllTimers());
      expect(input).toHaveValue('');
    });
  });

  describe('inputValue controlled', () => {
    it('follows the inputValue prop', () => {
      const wrapper = createWrapper({inputValue: 'initial value'});
      expect(input).toHaveValue('initial value');

      wrapper.rerender(createComponent({inputValue: 'new value'}));

      expect(input).toHaveValue('new value');
    });

    it('calls onInputValueChange on input', () => {
      const wrapper = createWrapper({inputValue: 'initial value'});
      const onInputValueChange = jest.fn();
      wrapper.rerender(createComponent({onInputValueChange}));
      fireEvent.focus(input);
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      fireEvent.change(input, {target: {value: 'a'}});

      expect(onInputValueChange).toHaveBeenCalledWith('a');
    });

    it('input value does not change when typed into', () => {
      createWrapper({inputValue: 'initial value'});
      fireEvent.focus(input);
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      fireEvent.change(input, {target: {value: 'a'}});
      expect(input).toHaveValue('initial value');
    });

    it('input value does not change when blurred', () => {
      createWrapper({inputValue: 'initial value'});
      fireEvent.focus(input);
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      fireEvent.blur(input);
      expect(input).toHaveValue('initial value');
    });

    it('can search for and select an item without changing the input value', () => {
      const wrapper = createWrapper({inputValue: 'initial value'});
      fireEvent.focus(input);
      wrapper.rerender(createComponent({inputValue: 'apple'}));
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      expect(screen.getAllByRole('option')).toHaveLength(2);

      fireEvent.click(screen.getByText('Apple'));

      expect(screen.queryByTestId('test-autocomplete')).not.toBeInTheDocument();
      expect(input).toHaveValue('apple');
      expect(mocks.onSelect).toHaveBeenCalledWith(
        {name: 'Apple'},
        expect.anything(),
        expect.anything()
      );
    });

    it('can filter and navigate dropdown items with keyboard and select with "Enter" keypress without changing input value', function () {
      const wrapper = createWrapper({inputValue: 'initial value'});
      wrapper.rerender(createComponent({inputValue: 'apple'}));
      fireEvent.focus(input);
      expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

      expect(screen.getByText('Apple')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getAllByRole('option')).toHaveLength(2);

      fireEvent.keyDown(input, {key: 'ArrowDown', charCode: 40});
      fireEvent.keyDown(input, {key: 'ArrowDown', charCode: 40});
      fireEvent.keyDown(input, {key: 'ArrowDown', charCode: 40});
      expect(screen.getByText('Pineapple')).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(input, {key: 'Enter', charCode: 13});

      expect(mocks.onSelect).toHaveBeenCalledWith(
        items[1],
        expect.objectContaining({highlightedIndex: 1}),
        expect.anything()
      );
      expect(mocks.onClose).toHaveBeenCalledTimes(1);
      expect(input).toHaveValue('apple');
    });
  });

  it('selects using enter key', function () {
    const wrapper = createWrapper({isOpen: true, shouldSelectWithEnter: false});
    fireEvent.change(input, {target: {value: 'pine'}});
    fireEvent.keyDown(input, {key: 'Enter', charCode: 13});
    expect(mocks.onSelect).not.toHaveBeenCalled();
    wrapper.unmount();

    createWrapper({isOpen: true, shouldSelectWithEnter: true});
    fireEvent.change(input, {target: {value: 'pine'}});
    fireEvent.keyDown(input, {key: 'Enter', charCode: 13});
    expect(mocks.onSelect).toHaveBeenCalledWith(
      items[1],
      expect.objectContaining({inputValue: 'pine', highlightedIndex: 0}),
      expect.anything()
    );
    expect(mocks.onClose).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('Pineapple');
  });

  it('selects using tab key', function () {
    let wrapper = createWrapper({isOpen: true, shouldSelectWithTab: false});
    fireEvent.change(input, {target: {value: 'pine'}});
    fireEvent.keyDown(input, {key: 'Tab', charCode: 9});
    expect(mocks.onSelect).not.toHaveBeenCalled();
    wrapper.unmount();

    wrapper = createWrapper({isOpen: true, shouldSelectWithTab: true});
    fireEvent.change(input, {target: {value: 'pine'}});
    fireEvent.keyDown(input, {key: 'Tab'});
    expect(mocks.onSelect).toHaveBeenCalledWith(
      items[1],
      expect.objectContaining({inputValue: 'pine', highlightedIndex: 0}),
      expect.anything()
    );
    expect(mocks.onClose).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('Pineapple');
  });

  it('does not reset highlight state if `closeOnSelect` is false and we select a new item', function () {
    createWrapper({closeOnSelect: false});
    jest.useFakeTimers();
    fireEvent.focus(input);
    expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

    fireEvent.keyDown(input, {key: 'ArrowDown', charCode: 40});
    expect(screen.getByText('Pineapple')).toHaveAttribute('aria-selected', 'true');

    // Select item
    fireEvent.keyDown(input, {key: 'Enter', charCode: 13});

    // Should still remain open with same highlightedIndex
    expect(screen.getByText('Pineapple')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();

    fireEvent.keyDown(input, {key: 'ArrowDown', charCode: 40});
    expect(screen.getByText('Orange')).toHaveAttribute('aria-selected', 'true');

    // Select item
    fireEvent.keyDown(input, {key: 'Enter', charCode: 13});

    // Should still remain open with same highlightedIndex
    expect(screen.getByText('Orange')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();
  });
});
