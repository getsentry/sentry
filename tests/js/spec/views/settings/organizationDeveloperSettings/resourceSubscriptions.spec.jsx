import React from 'react';

import {mount} from 'sentry-test/enzyme';

import FormModel from 'app/views/settings/components/forms/model';
import Subscriptions from 'app/views/settings/organizationDeveloperSettings/resourceSubscriptions';

describe('Resource Subscriptions', () => {
  let wrapper;
  let onChange;

  describe('initial no-access permissions', () => {
    beforeEach(() => {
      onChange = jest.fn();
      wrapper = mount(
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
        />,
        {
          context: {
            router: TestStubs.routerContext(),
            form: new FormModel(),
          },
        }
      );
    });

    it('renders disabled checkbox with no issue permission', () => {
      expect(
        wrapper
          .find('SubscriptionBox')
          .first()
          .prop('disabledFromPermissions')
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

      wrapper.setProps({permissions});
      expect(
        wrapper
          .find('SubscriptionBox')
          .first()
          .prop('disabledFromPermissions')
      ).toBe(false);
    });
  });

  describe('inital access to permissions', () => {
    beforeEach(() => {
      onChange = jest.fn();
      wrapper = mount(
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
        />,
        {
          context: {
            router: TestStubs.routerContext(),
            form: new FormModel(),
          },
        }
      );
    });

    it('renders nondisabled checkbox with correct permissions', () => {
      expect(
        wrapper
          .find('SubscriptionBox')
          .first()
          .prop('disabledFromPermissions')
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

      wrapper.setProps({permissions});
      expect(
        wrapper
          .find('SubscriptionBox')
          .first()
          .prop('disabledFromPermissions')
      ).toBe(true);
    });
  });
});
