import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SubscriptionBox from 'sentry/views/settings/organizationDeveloperSettings/subscriptionBox';

describe('SubscriptionBox', () => {
  const onChange = jest.fn();
  let org = TestStubs.Organization();

  beforeEach(() => {
    onChange.mockReset();
  });

  function renderComponent(props) {
    return render(
      <SubscriptionBox
        resource="issue"
        checked={false}
        disabledFromPermissions={false}
        onChange={onChange}
        organization={org}
        {...props}
      />
    );
  }

  it('renders resource checkbox', () => {
    const {container} = renderComponent();
    expect(container).toSnapshot();
  });

  it('calls onChange prop when checking checkbox', () => {
    renderComponent();

    userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith('issue', true);
  });

  it('disables the checkbox from permissions', async () => {
    renderComponent({disabledFromPermissions: true});

    expect(screen.getByRole('checkbox')).toBeDisabled();

    userEvent.hover(screen.getByRole('checkbox'));
    expect(
      await screen.findByText("Must have at least 'Read' permissions enabled for Event")
    ).toBeInTheDocument();
  });

  describe('error.created resource subscription', () => {
    it('checkbox disabled without integrations-event-hooks flag', async () => {
      renderComponent({resource: 'error'});

      expect(screen.getByRole('checkbox')).toBeDisabled();

      userEvent.hover(screen.getByRole('checkbox'));
      expect(
        await screen.findByText(
          'Your organization does not have access to the error subscription resource.'
        )
      ).toBeInTheDocument();
    });

    it('checkbox visible with integrations-event-hooks flag', () => {
      org = TestStubs.Organization({features: ['integrations-event-hooks']});
      renderComponent({resource: 'error', organization: org});

      expect(screen.getByRole('checkbox')).toBeEnabled();
    });
  });

  it('disables checkbox when webhookDisabled=true', async () => {
    renderComponent({resource: 'error', webhookDisabled: true});

    expect(screen.getByRole('checkbox')).toBeDisabled();

    userEvent.hover(screen.getByRole('checkbox'));
    expect(
      await screen.findByText(
        'Cannot enable webhook subscription without specifying a webhook url'
      )
    ).toBeInTheDocument();
  });
});
