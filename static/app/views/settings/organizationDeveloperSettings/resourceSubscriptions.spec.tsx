import {render, screen} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/forms/form';
import Subscriptions from 'sentry/views/settings/organizationDeveloperSettings/resourceSubscriptions';

describe('Resource Subscriptions', function () {
  describe('initial no-access permissions', function () {
    it('renders disabled checkbox with no issue permission', function () {
      render(
        <Form>
          <Subscriptions
            events={[]}
            permissions={{
              Event: 'no-access',
              Team: 'no-access',
              Project: 'write',
              Release: 'admin',
              Organization: 'admin',
              Member: 'admin',
            }}
            onChange={jest.fn()}
          />
        </Form>
      );

      expect(screen.getAllByRole('checkbox')).toHaveLength(3);
      expect(screen.getByRole('checkbox', {name: 'issue'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'error'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'comment'})).toBeDisabled();
    });

    it('updates events state when new permissions props is passed', function () {
      render(
        <Form>
          <Subscriptions
            events={[]}
            permissions={{
              Event: 'read',
              Team: 'no-access',
              Project: 'write',
              Release: 'admin',
              Organization: 'admin',
              Member: 'admin',
            }}
            onChange={jest.fn()}
          />
        </Form>
      );

      expect(screen.getByRole('checkbox', {name: 'issue'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'error'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'comment'})).toBeEnabled();
    });
  });

  describe('initial access to permissions', function () {
    it('renders nondisabled checkbox with correct permissions', function () {
      render(
        <Form>
          <Subscriptions
            events={['issue']}
            permissions={{
              Event: 'read',
              Team: 'no-access',
              Project: 'write',
              Release: 'admin',
              Organization: 'admin',
              Member: 'admin',
            }}
            onChange={jest.fn()}
          />
        </Form>
      );

      expect(screen.getByRole('checkbox', {name: 'issue'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'error'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'comment'})).toBeEnabled();
    });

    it('revoked permissions also revokes access to corresponding subscriptions', function () {
      render(
        <Form>
          <Subscriptions
            events={['issue']}
            permissions={{
              Event: 'no-access',
              Team: 'no-access',
              Project: 'write',
              Release: 'admin',
              Organization: 'admin',
              Member: 'admin',
            }}
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
