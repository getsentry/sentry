import {z} from 'zod';

import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
import {triggerResizeObservers} from 'sentry-test/resizeObserver';

import {defaultFormOptions, DisplayField, useScrapsForm} from '@sentry/scraps/form';
import {Container} from '@sentry/scraps/layout';

function ExampleForm({onSubmit}: {onSubmit?: (value: {name: string}) => void}) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {name: ''},
    validators: {onDynamic: z.object({name: z.string().min(1, 'Enter a name')})},
    onSubmit: ({value}) => onSubmit?.(value),
  });

  return (
    <form.AppForm form={form}>
      <DisplayField.Row label="Created" hintText="When the key was created.">
        January 1, 2025
      </DisplayField.Row>
      <form.AppField name="name">
        {field => (
          <field.Layout.Row label="Name" hintText="Enter a key name.">
            <field.Input value={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </form.AppField>
      <form.SubmitButton>Save</form.SubmitButton>
    </form.AppForm>
  );
}

describe('DisplayField', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders a description list without a form provider', () => {
    render(
      <DisplayField.Row label="Created" hintText="When the key was created.">
        January 1, 2025
      </DisplayField.Row>
    );

    const term = screen.getByRole('term');
    const definition = screen.getByRole('definition');
    expect(term).toHaveTextContent('Created');
    expect(term).toHaveTextContent('When the key was created.');
    expect(definition).toHaveTextContent('January 1, 2025');
    expect(term.closest('dl')).toBe(definition.parentElement);
  });

  it('places the hint after the value in the stack layout', () => {
    render(
      <DisplayField.Stack label="Created" hintText="When the key was created.">
        January 1, 2025
      </DisplayField.Stack>
    );

    expect(screen.getByRole('term')).toHaveTextContent(/^Created$/);
    expect(screen.getByRole('definition')).toHaveTextContent(
      'January 1, 2025When the key was created.'
    );
  });

  it('stacks at the same container breakpoint as bound form fields', () => {
    const width = jest
      .spyOn(Element.prototype, 'clientWidth', 'get')
      .mockReturnValue(1200);

    render(
      <Container containerType="inline-size">
        <ExampleForm />
      </Container>
    );

    expect(
      within(screen.getByRole('term')).getByText('When the key was created.')
    ).toBeInTheDocument();
    expect(
      screen
        .getByText('Enter a key name.')
        .compareDocumentPosition(screen.getByRole('textbox', {name: 'Name'}))
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    act(() => {
      width.mockReturnValue(200);
      triggerResizeObservers();
    });

    expect(
      within(screen.getByRole('definition')).getByText('When the key was created.')
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole('textbox', {name: 'Name'})
        .compareDocumentPosition(screen.getByText('Enter a key name.'))
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('leaves focus, validation, and submitted values to the inputs', async () => {
    const onSubmit = jest.fn();
    render(<ExampleForm onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox', {name: 'Name'});
    await userEvent.tab();
    expect(input).toHaveFocus();

    await userEvent.click(screen.getByRole('button', {name: 'Save'}));
    expect(input).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.type(input, 'Example');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));
    expect(onSubmit).toHaveBeenCalledWith({name: 'Example'});
  });
});
