import {mountWithTheme} from 'sentry-test/enzyme';

import Form from 'app/views/settings/components/forms/form';
import Subscriptions from 'app/views/settings/organizationDeveloperSettings/resourceSubscriptions';

describe('Resource Subscriptions', () => {
  let wrapper;
  let onChange;

  describe('initial no-access permissions', () => {
    beforeEach(() => {
      onChange = jest.fn();
      wrapper = mountWithTheme(
        <Form>
          <Subscriptions
            events={[]}
            permissions={{
              Event: 'no-access',
              Team: 'no-access',
              Project: 'write',
              Release: 'admin',
              Organization: 'admin',
            }}
            onChange={onChange}
          />
        </Form>,
        TestStubs.routerContext()
      );
    });

    it('renders disabled checkbox with no issue permission', () => {
      expect(
        wrapper.find('SubscriptionBox').first().prop('disabledFromPermissions')
      ).toBe(true);
    });

    it('updates events state when new permissions props is passed', () => {
      const permissions = {
        Event: 'read',
        Team: 'no-access',
        Project: 'write',
        Release: 'admin',
        Organization: 'admin',
      };
      wrapper = mountWithTheme(
        <Form>
          <Subscriptions events={[]} permissions={permissions} onChange={onChange} />
        </Form>,
        TestStubs.routerContext()
      );

      expect(
        wrapper.find('SubscriptionBox').first().prop('disabledFromPermissions')
      ).toBe(false);
    });
  });

  describe('initial access to permissions', () => {
    beforeEach(() => {
      onChange = jest.fn();
      wrapper = mountWithTheme(
        <Form>
          <Subscriptions
            events={['issue']}
            permissions={{
              Event: 'read',
              Team: 'no-access',
              Project: 'write',
              Release: 'admin',
              Organization: 'admin',
            }}
            onChange={onChange}
          />
        </Form>,
        TestStubs.routerContext()
      );
    });

    it('renders nondisabled checkbox with correct permissions', () => {
      expect(
        wrapper.find('SubscriptionBox').first().prop('disabledFromPermissions')
      ).toBe(false);
    });

    it('revoked permissions also revokes access to corresponding subscriptions', () => {
      const permissions = {
        Event: 'no-access',
        Team: 'no-access',
        Project: 'write',
        Release: 'admin',
        Organization: 'admin',
      };
      wrapper = mountWithTheme(
        <Form>
          <Subscriptions
            events={['issue']}
            permissions={permissions}
            onChange={onChange}
          />
        </Form>,
        TestStubs.routerContext()
      );

      wrapper.setProps({permissions});
      expect(
        wrapper.find('SubscriptionBox').first().prop('disabledFromPermissions')
      ).toBe(true);
    });
  });
});
