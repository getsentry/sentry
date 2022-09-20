import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EditableText from 'sentry/components/editableText';

describe('EditableText', function () {
  it('edit value and click outside of the component', function () {
    const handleChange = jest.fn();

    render(<EditableText value="foo" onChange={handleChange} />);

    // Click on the input
    userEvent.click(screen.getByText('foo'));

    // Clear input value
    userEvent.clear(screen.getByRole('textbox'));

    // Edit input value
    userEvent.type(screen.getByRole('textbox'), 'bar');

    // Click outside of the component
    userEvent.click(document.body);

    expect(handleChange).toHaveBeenCalledWith('bar');

    expect(screen.queryByText('foo')).not.toBeInTheDocument();

    expect(screen.getByText('bar')).toBeInTheDocument();
  });

  it('clear value and show error message', function () {
    const handleChange = jest.fn();

    render(<EditableText value="foo" onChange={handleChange} />);

    // Click on the input
    userEvent.click(screen.getByText('foo'));

    // Clear input value
    userEvent.clear(screen.getByRole('textbox'));

    // Press enter to submit the value
    userEvent.keyboard('{enter}');

    expect(handleChange).toHaveBeenCalledTimes(0);
  });

  it('displays a disabled value', function () {
    render(<EditableText value="foo" onChange={jest.fn()} isDisabled />);

    // Click on the input
    userEvent.click(screen.getByText('foo'));

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('edit value and press escape', function () {
    const handleChange = jest.fn();

    render(<EditableText value="foo" onChange={handleChange} />);

    // Click on the input
    userEvent.click(screen.getByText('foo'));

    // Edit input value
    userEvent.type(screen.getByRole('textbox'), '-bar');

    // Press escape to cancel the value
    userEvent.keyboard('{esc}');

    expect(handleChange).toHaveBeenCalledTimes(0);

    expect(screen.getByText('foo')).toBeInTheDocument();
  });

  it('enforces a max length if provided', function () {
    render(<EditableText value="foo" onChange={jest.fn()} maxLength={4} />);

    // Click on the input
    userEvent.click(screen.getByText('foo'));

    // Edit input value
    userEvent.type(screen.getByRole('textbox'), '-bar');

    // Display a text with the max length of 4 caracters
    expect(screen.getByText('foo-')).toBeInTheDocument();
  });
});
