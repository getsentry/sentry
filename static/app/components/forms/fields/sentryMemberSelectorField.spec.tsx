import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import MemberListStore from 'sentry/stores/memberListStore';
import OrganizationStore from 'sentry/stores/organizationStore';

import {SentryMemberSelectorField} from './sentryMemberSelectorField';

describe('SentryMemberSelectorField', () => {
  const organization = OrganizationFixture();
  const mockUsers = [UserFixture({id: '1', name: 'Jane Doe', email: 'jane@example.com'})];

  beforeEach(() => {
    MemberListStore.init();
    MemberListStore.loadInitialData(mockUsers);
    OrganizationStore.onUpdate(organization, {replace: true});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      body: [],
    });
  });

  it('can select a member', async () => {
    const mock = jest.fn();

    render(
      <SentryMemberSelectorField onChange={mock} name="member" label="Select Member" />
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Select Member'}),
      'Jane Doe'
    );

    expect(mock).toHaveBeenCalledWith(1, expect.anything());
  });
});
