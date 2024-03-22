import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {AutofixBanner} from './autofixBanner';

function mockIsSentryEmployee(isEmployee: boolean) {
  jest
    .spyOn(require('sentry/utils/useIsSentryEmployee'), 'useIsSentryEmployee')
    .mockImplementation(() => isEmployee);
}

describe('AutofixBanner', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('shows PII check for sentry employee users', () => {
    mockIsSentryEmployee(true);

    render(<AutofixBanner triggerAutofix={() => {}} />);
    expect(
      screen.getByText(
        'By clicking the button above, you confirm that there is no PII in this event.'
      )
    ).toBeInTheDocument();
  });

  it('does not show PII check for non sentry employee users', () => {
    mockIsSentryEmployee(false);

    render(<AutofixBanner triggerAutofix={() => {}} />);
    expect(
      screen.queryByText(
        'By clicking the button above, you confirm that there is no PII in this event.'
      )
    ).not.toBeInTheDocument();
  });

  it('can run without instructions', async () => {
    const mockTriggerAutofix = jest.fn();

    render(<AutofixBanner triggerAutofix={mockTriggerAutofix} />);
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Gimme Fix'}));
    expect(mockTriggerAutofix).toHaveBeenCalledWith('');
  });

  it('can provide instructions', async () => {
    const mockTriggerAutofix = jest.fn();

    render(<AutofixBanner triggerAutofix={mockTriggerAutofix} />);
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Give Instructions'}));
    await userEvent.type(screen.getByRole('textbox'), 'instruction!');
    await userEvent.click(screen.getByRole('button', {name: "Let's go!"}));

    expect(mockTriggerAutofix).toHaveBeenCalledWith('instruction!');
  });
});
