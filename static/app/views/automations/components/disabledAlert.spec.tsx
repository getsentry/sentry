import {AutomationFixture} from 'sentry-fixture/automations';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {DisabledAlert} from './disabledAlert';

describe('DisabledAlert', () => {
  const organization = OrganizationFixture({
    access: ['org:write', 'alerts:write'],
    alertsMemberWrite: true,
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('does not render when automation is enabled', () => {
    const automation = AutomationFixture({enabled: true});

    const {container} = render(<DisabledAlert automation={automation} />, {
      organization,
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('renders alert with message and enable button when automation is disabled', () => {
    const automation = AutomationFixture({enabled: false});

    render(<DisabledAlert automation={automation} />, {
      organization,
    });

    expect(
      screen.getByText('This alert is disabled and will not send notifications.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Enable'})).toBeInTheDocument();
  });

  it('enables automation when enable button is clicked', async () => {
    const automation = AutomationFixture({
      id: '123',
      enabled: false,
    });

    const updateRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/123/',
      method: 'PUT',
      body: {...automation, enabled: true},
    });

    render(<DisabledAlert automation={automation} />, {
      organization,
    });

    const enableButton = await screen.findByRole('button', {name: 'Enable'});
    expect(enableButton).toBeEnabled();

    await userEvent.click(enableButton);

    await waitFor(() => {
      expect(updateRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'PUT',
          data: {id: '123', name: automation.name, enabled: true},
        })
      );
    });
  });

  it('disables enable button when user does not have alerts:write permission', async () => {
    const organizationWithoutAccess = OrganizationFixture({
      access: ['org:read'],
      alertsMemberWrite: false,
    });
    const automation = AutomationFixture({enabled: false});

    render(<DisabledAlert automation={automation} />, {
      organization: organizationWithoutAccess,
    });

    const enableButton = screen.getByRole('button', {name: 'Enable'});
    expect(enableButton).toBeDisabled();

    await userEvent.hover(enableButton);
    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'You do not have permission to edit this alert. Ask your organization owner or manager to enable alert access for you.'
        )
      )
    ).toBeInTheDocument();
  });
});
