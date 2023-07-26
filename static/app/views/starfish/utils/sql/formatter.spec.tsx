import {SQLishFormatter} from 'sentry/views/starfish/utils/sql/formatter';

describe('SQLishFormatter', function () {
  it('Formats basic SQL', () => {
    const formatter = new SQLishFormatter('SELECT hello FROM users;');

    expect(formatter.toString()).toEqual('SELECT hello \nFROM users');
  });
});
