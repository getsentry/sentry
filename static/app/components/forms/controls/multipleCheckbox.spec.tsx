import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import MultipleCheckbox from 'sentry/components/forms/controls/multipleCheckbox';

describe('MultipleCheckbox', function () {
  it('renders', function () {
    render(
      <MultipleCheckbox name="test" value={[1]}>
        <MultipleCheckbox.Item value={0}>Choice A</MultipleCheckbox.Item>
        <MultipleCheckbox.Item value={1}>Choice B</MultipleCheckbox.Item>
        <MultipleCheckbox.Item value={2}>Choice C</MultipleCheckbox.Item>
      </MultipleCheckbox>
    );
  });

  it('unselects a checked input', async function () {
    const onChange = jest.fn();
    render(
      <MultipleCheckbox name="test" value={[1]} onChange={onChange}>
        <MultipleCheckbox.Item value={0}>Choice A</MultipleCheckbox.Item>
        <MultipleCheckbox.Item value={1}>Choice B</MultipleCheckbox.Item>
        <MultipleCheckbox.Item value={2}>Choice C</MultipleCheckbox.Item>
      </MultipleCheckbox>
    );

    await userEvent.click(screen.getByLabelText('Choice B'));
    expect(onChange).toHaveBeenCalledWith([], expect.anything());
  });

  it('selects an unchecked input', async function () {
    const onChange = jest.fn();
    render(
      <MultipleCheckbox name="test" value={[1]} onChange={onChange}>
        <MultipleCheckbox.Item value={0}>Choice A</MultipleCheckbox.Item>
        <MultipleCheckbox.Item value={1}>Choice B</MultipleCheckbox.Item>
        <MultipleCheckbox.Item value={2}>Choice C</MultipleCheckbox.Item>
      </MultipleCheckbox>
    );

    await userEvent.click(screen.getByLabelText('Choice A'));
    expect(onChange).toHaveBeenCalledWith([1, 0], expect.anything());
  });
});
