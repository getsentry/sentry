import type {ComponentProps} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SubscriptionBox} from 'sentry/views/settings/organizationDeveloperSettings/subscriptionBox';

describe('SubscriptionBox', () => {
  const onChange = jest.fn();
  const onEventChange = jest.fn();

  beforeEach(() => {
    onChange.mockReset();
    onEventChange.mockReset();
  });
  function renderComponent(
    props: Partial<ComponentProps<typeof SubscriptionBox>> = {},
    {organization = OrganizationFixture()} = {}
  ) {
    return render(
      <SubscriptionBox
        resource="issue"
        checked={false}
        selectedEvents={[]}
        disabledFromPermissions={false}
        onChange={onChange}
        onEventChange={onEventChange}
        isNew={false}
        {...props}
      />,
      {organization}
    );
  }

  it('renders resource checkbox', () => {
    renderComponent();
  });

  it('calls onChange prop when checking checkbox', async () => {
    renderComponent();

    await userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith('issue', true);
  });

  it('disables the checkbox from permissions', async () => {
    renderComponent({disabledFromPermissions: true});

    expect(screen.getByRole('checkbox')).toBeDisabled();

    await userEvent.hover(screen.getByRole('checkbox'));
    expect(
      await screen.findByText("Must have at least 'Read' permissions enabled for Event")
    ).toBeInTheDocument();
  });

  describe('error.created resource subscription', () => {
    it('checkbox disabled without integrations-event-hooks flag', async () => {
      renderComponent({resource: 'error'});

      expect(screen.getByRole('checkbox')).toBeDisabled();

      await userEvent.hover(screen.getByRole('checkbox'));
      expect(
        await screen.findByText(
          'Your organization does not have access to the error subscription resource.'
        )
      ).toBeInTheDocument();
    });

    it('checkbox visible with integrations-event-hooks flag', () => {
      renderComponent(
        {resource: 'error'},
        {organization: OrganizationFixture({features: ['integrations-event-hooks']})}
      );

      expect(screen.getByRole('checkbox')).toBeEnabled();
    });
  });

  describe('granular event subscriptions', () => {
    const organization = OrganizationFixture({
      features: ['sentry-apps-granular-events'],
    });

    it('renders a checkbox per event', () => {
      renderComponent({selectedEvents: ['issue.created']}, {organization});

      expect(screen.getAllByRole('checkbox')).toHaveLength(6);
      expect(screen.getByRole('checkbox', {name: 'issue.created'})).toBeChecked();
      expect(screen.getByRole('checkbox', {name: 'issue.resolved'})).not.toBeChecked();
    });

    it('calls onEventChange when toggling an event', async () => {
      renderComponent({}, {organization});

      await userEvent.click(screen.getByRole('checkbox', {name: 'issue.resolved'}));
      expect(onEventChange).toHaveBeenCalledWith('issue.resolved', true);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not render event checkboxes without the flag', () => {
      renderComponent({selectedEvents: ['issue.created']});

      expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    });
  });

  describe('preprod_artifact resource subscription', () => {
    it('hidden without preprod-artifact-webhooks flag', () => {
      renderComponent({resource: 'preprod_artifact'});

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('renders preprod_artifact checkbox enabled with preprod-artifact-webhooks flag', () => {
      renderComponent(
        {resource: 'preprod_artifact'},
        {organization: OrganizationFixture({features: ['preprod-artifact-webhooks']})}
      );

      expect(screen.getByRole('checkbox')).toBeEnabled();
    });
  });
});
