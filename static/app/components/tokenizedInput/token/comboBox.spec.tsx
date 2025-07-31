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

describe('ComboBox', function () {
  it('can click to select an option', async function () {
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
});
