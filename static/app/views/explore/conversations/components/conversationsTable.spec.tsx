import {getUserDisplayName} from './conversationsTable';

describe('getUserDisplayName', () => {
  it('uses the user ID when no other identifying fields are available', () => {
    expect(
      getUserDisplayName({id: '123', email: null, username: null, ip_address: null})
    ).toBe('123');
  });
});
