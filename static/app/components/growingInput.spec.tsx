import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {GrowingInput} from 'sentry/components/growingInput';

describe('GrowingInput', () => {
  it('can be controlled', () => {
    const {rerender} = render(
      <GrowingInput aria-label="Label" value="Lorem ipsum dolor" />
    );
    const inputBefore = screen.getByRole('textbox', {name: 'Label'});
    expect(inputBefore).toHaveValue('Lorem ipsum dolor');
    expect(inputBefore).toBeInTheDocument();

    rerender(<GrowingInput aria-label="Label" value="Lorem ipsum dolor sit amat" />);
    const inputAfter = screen.getByRole('textbox', {name: 'Label'});
    expect(inputAfter).toHaveValue('Lorem ipsum dolor sit amat');
    expect(inputAfter).toBeInTheDocument();
  });

  it('can be uncontrolled', async () => {
    const handleChange = jest.fn();
    render(
      <GrowingInput
        onChange={handleChange}
        aria-label="Label"
        defaultValue="Lorem ipsum dolor"
      />
    );
    const inputBefore = screen.getByRole('textbox', {name: 'Label'});
    expect(inputBefore).toHaveValue('Lorem ipsum dolor');
    expect(inputBefore).toBeInTheDocument();

    await userEvent.type(inputBefore, ' sit amat');

    expect(handleChange).toHaveBeenCalledTimes(9);
    expect(handleChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({value: 'Lorem ipsum dolor sit amat'}),
      })
    );

    const inputAfter = screen.getByRole('textbox', {name: 'Label'});
    expect(inputAfter).toHaveValue('Lorem ipsum dolor sit amat');
    expect(inputAfter).toBeInTheDocument();
  });
});
