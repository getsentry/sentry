import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Form} from 'sentry/components/forms/form';
import type {Permissions} from 'sentry/types/integrations';
import type {WebhookSubscription} from 'sentry/views/settings/organizationDeveloperSettings/constants';
import {RESOURCE_EVENTS} from 'sentry/views/settings/organizationDeveloperSettings/constants';
import {Subscriptions} from 'sentry/views/settings/organizationDeveloperSettings/resourceSubscriptions';

const basePermissions: Permissions = {
  Event: 'read',
  Team: 'no-access',
  Project: 'write',
  Release: 'admin',
  Organization: 'admin',
  Member: 'admin',
};

describe('Resource Subscriptions', () => {
  describe('initial no-access permissions', () => {
    it('renders disabled checkbox with no issue permission', () => {
      const org = OrganizationFixture({features: ['preprod-artifact-webhooks']});
      render(
        <Form>
          <Subscriptions
            events={[]}
            permissions={{...basePermissions, Event: 'no-access'}}
            onChange={jest.fn()}
          />
        </Form>,
        {organization: org}
      );

      expect(screen.getAllByRole('checkbox')).toHaveLength(5);
      expect(screen.getByRole('checkbox', {name: 'issue'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'error'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'comment'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'seer'})).toBeDisabled();
      // preprod_artifact requires Project permission which is 'write' here, so it's enabled
      expect(screen.getByRole('checkbox', {name: 'preprod_artifact'})).toBeEnabled();
    });

    it('hides preprod_artifact checkbox without preprod-artifact-webhooks flag', () => {
      render(
        <Form>
          <Subscriptions
            events={[]}
            permissions={{...basePermissions, Event: 'no-access'}}
            onChange={jest.fn()}
          />
        </Form>
      );

      expect(screen.getAllByRole('checkbox')).toHaveLength(4);
      expect(
        screen.queryByRole('checkbox', {name: 'preprod_artifact'})
      ).not.toBeInTheDocument();
    });

    it('updates events state when new permissions props is passed', () => {
      render(
        <Form>
          <Subscriptions events={[]} permissions={basePermissions} onChange={jest.fn()} />
        </Form>
      );

      expect(screen.getByRole('checkbox', {name: 'issue'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'error'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'comment'})).toBeEnabled();
    });
  });

  describe('granular event subscriptions', () => {
    const organization = OrganizationFixture({
      features: ['sentry-apps-granular-events'],
    });

    function renderSubscriptions(
      events: WebhookSubscription[],
      permissions: Permissions = basePermissions
    ) {
      const onChange = jest.fn();
      render(
        <Form>
          <Subscriptions events={events} permissions={permissions} onChange={onChange} />
        </Form>,
        {organization}
      );
      return onChange;
    }

    it('describes webhook delivery and links the docs', () => {
      renderSubscriptions([]);

      expect(
        screen.getByRole('link', {name: 'webhook documentation'})
      ).toBeInTheDocument();
    });

    it('marks a partially subscribed resource as mixed', () => {
      renderSubscriptions(['issue.created']);

      expect(screen.getByRole('checkbox', {name: 'issue'})).toBePartiallyChecked();
      expect(screen.getByRole('checkbox', {name: 'issue.created'})).toBeChecked();
      expect(screen.getByRole('checkbox', {name: 'issue.resolved'})).not.toBeChecked();
    });

    it('toggles a single event', async () => {
      const onChange = renderSubscriptions(['issue.created']);

      await userEvent.click(screen.getByRole('checkbox', {name: 'issue.resolved'}));
      expect(onChange).toHaveBeenCalledWith(['issue.created', 'issue.resolved']);
    });

    it('selects every event when checking the resource', async () => {
      const onChange = renderSubscriptions(['issue.created']);

      await userEvent.click(screen.getByRole('checkbox', {name: 'issue'}));
      expect(onChange).toHaveBeenCalledWith([...RESOURCE_EVENTS.issue]);
    });

    it('clears every event when unchecking the resource', async () => {
      const onChange = renderSubscriptions([...RESOURCE_EVENTS.issue, 'comment.created']);

      expect(screen.getByRole('checkbox', {name: 'issue'})).toBeChecked();
      await userEvent.click(screen.getByRole('checkbox', {name: 'issue'}));
      expect(onChange).toHaveBeenCalledWith(['comment.created']);
    });

    it('strips events whose permission is revoked', () => {
      const onChange = renderSubscriptions(
        ['issue.created', 'preprod_artifact.size_analysis_completed'],
        {...basePermissions, Event: 'no-access'}
      );

      expect(onChange).toHaveBeenCalledWith(['preprod_artifact.size_analysis_completed']);
    });
  });

  describe('initial access to permissions', () => {
    it('renders nondisabled checkbox with correct permissions', () => {
      render(
        <Form>
          <Subscriptions
            events={['issue']}
            permissions={basePermissions}
            onChange={jest.fn()}
          />
        </Form>
      );

      expect(screen.getByRole('checkbox', {name: 'issue'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'error'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'comment'})).toBeEnabled();
    });

    it('revoked permissions also revokes access to corresponding subscriptions', () => {
      render(
        <Form>
          <Subscriptions
            events={['issue']}
            permissions={{...basePermissions, Event: 'no-access'}}
            onChange={jest.fn()}
          />
        </Form>
      );

      expect(screen.getByRole('checkbox', {name: 'issue'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'error'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'comment'})).toBeDisabled();
    });
  });
});
