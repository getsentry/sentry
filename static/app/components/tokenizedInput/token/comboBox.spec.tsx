import type {ComponentProps} from 'react';
import {Item} from '@react-stately/collections';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ComboBox} from 'sentry/components/tokenizedInput/token/comboBox';

function ComboBoxWrapper(props: Omit<ComponentProps<typeof ComboBox>, 'children'>) {
  return (
    <ComboBox {...props}>
      {item => (
        <Item {...item} key={item.key}>
          {item.label}
        </Item>
      )}
    </ComboBox>
  );
}

describe('ComboBox', () => {
  it('can click to select an option', async () => {
    const onClick = jest.fn();
    const onOptionSelected = jest.fn();
    render(
      <ComboBoxWrapper
        filterValue=""
        inputLabel="combobox"
        inputValue=""
        items={['foo', 'bar', 'qux'].map(item => ({
          key: item,
          label: item,
          value: item,
        }))}
        onClick={onClick}
        onOptionSelected={onOptionSelected}
      />
    );

    await userEvent.click(screen.getByRole('combobox'));
    expect(onClick).toHaveBeenCalled();

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);

    await userEvent.click(options[0]!);
    expect(onOptionSelected).toHaveBeenCalledWith({
      key: 'foo',
      label: 'foo',
      value: 'foo',
    });
  });

  it('does not open the menu when there are no options', async () => {
    const onOpenChange = jest.fn();
    render(
      <ComboBoxWrapper
        filterValue=""
        inputLabel="combobox"
        inputValue=""
        items={[]}
        onOpenChange={onOpenChange}
      />
    );

    await userEvent.click(screen.getByRole('combobox'));

    expect(onOpenChange).not.toHaveBeenCalledWith(true);
  });

  it('does not open the menu when every option is filtered out', async () => {
    const onOpenChange = jest.fn();
    render(
      <ComboBoxWrapper
        filterValue="nomatch"
        inputLabel="combobox"
        inputValue="nomatch"
        items={['foo', 'bar', 'qux'].map(item => ({
          key: item,
          label: item,
          value: item,
        }))}
        onOpenChange={onOpenChange}
      />
    );

    await userEvent.click(screen.getByRole('combobox'));

    expect(onOpenChange).not.toHaveBeenCalledWith(true);
  });
});
