import {getUserOrgNavigationConfiguration} from './userOrgNavigationConfiguration';

describe('getUserOrgNavigationConfiguration', () => {
  it('marks API Keys as permanently hidden (show: false)', () => {
    // SEC-551: the API Keys page is deprecated; it must never appear in the
    // settings sidebar or in cmd+k regardless of org access/features.
    const apiKeysItem = getUserOrgNavigationConfiguration()
      .flatMap(section => section.items)
      .find(item => item.id === 'api-keys');

    expect(apiKeysItem).toBeDefined();
    expect(apiKeysItem?.show).toBe(false);
  });
});
