import {getEmbedLinkHref} from './resourceEmbedTestUtils';

describe('saved issue view embed', () => {
  it('links a saved issue view to the view route', () => {
    expect(
      getEmbedLinkHref('savedIssueView', 'Unresolved', {id: '77', name: 'Unresolved'})
    ).toBe('/organizations/org-slug/issues/views/77/');
  });
});
