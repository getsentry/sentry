import {screen} from 'sentry-test/reactTestingLibrary';

import {getEmbedLinkHref, renderEmbed} from './resourceEmbedTestUtils';

describe('issues query embed', () => {
  it('carries the search string and page filters into the issue stream', () => {
    const href = getEmbedLinkHref('issuesQuery', 'Unresolved errors', {
      query: 'is:unresolved level:error',
      statsPeriod: '7d',
      projects: ['1', '2'],
      title: 'Unresolved errors',
    });

    expect(href).toContain('/organizations/org-slug/issues/');
    expect(href).toContain('query=is%3Aunresolved%20level%3Aerror');
    expect(href).toContain('statsPeriod=7d');
    expect(href).toContain('project=1');
    expect(href).toContain('project=2');
  });

  it('uses a generic label when Seer supplies no title', () => {
    renderEmbed({name: 'issuesQuery', data: {query: 'is:unresolved'}});
    expect(screen.getByRole('link', {name: 'Issue search'})).toBeInTheDocument();
  });
});
