import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import MultipleCheckbox from 'sentry/components/forms/controls/multipleCheckbox';

describe('MultipleCheckbox', function () {
  it('renders', function () {
    const {container} = mountWithTheme(
      <MultipleCheckbox
        choices={[
          [0, 'Choice A'],
          [1, 'Choice B'],
          [2, 'Choice C'],
        ]}
        value={[1]}
      />
    );

    expect(container).toSnapshot();
  });

  it('unselects a checked input', function () {
    const onChange = jest.fn();
    mountWithTheme(
      <MultipleCheckbox
        choices={[
          [0, 'Choice A'],
          [1, 'Choice B'],
          [2, 'Choice C'],
        ]}
        value={[1]}
        onChange={onChange}
      />
    );

    userEvent.click(screen.getByLabelText('Choice B'));
    expect(onChange).toHaveBeenCalledWith([], expect.anything());
  });

  it('selects an unchecked input', function () {
    const onChange = jest.fn();
    mountWithTheme(
      <MultipleCheckbox
        choices={[
          [0, 'Choice A'],
          [1, 'Choice B'],
          [2, 'Choice C'],
        ]}
        value={[1]}
        onChange={onChange}
      />
    );

    userEvent.click(screen.getByLabelText('Choice A'));
    expect(onChange).toHaveBeenCalledWith([1, 0], expect.anything());
  });
});
