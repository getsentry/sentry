import {renderEmbedMarkdown} from './resourceEmbedTestUtils';
import {User} from './user';

describe('user embed', () => {
  it('drops the avatar and keeps the name at the markdown level', () => {
    expect(
      renderEmbedMarkdown(User, 'user', {id: '1', type: 'user', name: 'Jane Doe'})
    ).toBe('Jane Doe');
  });

  it('writes a team with the hash its name is always shown with', () => {
    expect(
      renderEmbedMarkdown(User, 'user', {id: '2', type: 'team', name: 'platform'})
    ).toBe('#platform');
  });
});
