import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EditableText from 'sentry/components/editableText';

describe('EditableText', function () {
  it('edit value and click outside of the component', async function () {
    const handleChange = jest.fn();

    render(<EditableText value="foo" onChange={handleChange} />);

    // Click on the input
    await userEvent.click(screen.getByText('foo'));

    // Clear input value
    await userEvent.clear(screen.getByRole('textbox'));

    // Edit input value
    await userEvent.type(screen.getByRole('textbox'), 'bar');

    // Click outside of the component
    await userEvent.click(document.body);

    expect(handleChange).toHaveBeenCalledWith('bar');

    expect(screen.queryByText('foo')).not.toBeInTheDocument();

    expect(screen.getByText('bar')).toBeInTheDocument();
  });

  it('clear value and show error message', async function () {
    const handleChange = jest.fn();

    render(<EditableText value="foo" onChange={handleChange} />);

    // Click on the input
    await userEvent.click(screen.getByText('foo'));

    // Clear input value
    await userEvent.clear(screen.getByRole('textbox'));

    // Press enter to submit the value
    await userEvent.keyboard('{enter}');

    expect(handleChange).toHaveBeenCalledTimes(0);
  });

  it('displays a disabled value', async function () {
    render(<EditableText value="foo" onChange={jest.fn()} isDisabled />);

    // Click on the input
    await userEvent.click(screen.getByText('foo'));

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('edit value and press escape', async function () {
    const handleChange = jest.fn();

    render(<EditableText value="foo" onChange={handleChange} />);

    // Click on the input
    await userEvent.click(screen.getByText('foo'));

    // Edit input value
    await userEvent.type(screen.getByRole('textbox'), '-bar');

    // Press escape to cancel the value
    await userEvent.keyboard('{Escape}');

    expect(handleChange).toHaveBeenCalledTimes(0);

    expect(screen.getByText('foo')).toBeInTheDocument();
  });

  it('enforces a max length if provided', async function () {
    render(<EditableText value="foo" onChange={jest.fn()} maxLength={4} />);

    // Click on the input
    await userEvent.click(screen.getByText('foo'));

    // Edit input value
    await userEvent.type(screen.getByRole('textbox'), '-bar');

    // Display a text with the max length of 4 caracters
    expect(screen.getByText('foo-')).toBeInTheDocument();
  });
});
