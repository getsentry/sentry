import {act, render, renderHook} from 'sentry-test/reactTestingLibrary';

import {DocumentTitleManager, useDocumentTitleManager} from './documentTitleManager';
import {SentryDocumentTitle} from '.';

describe('SentryDocumentTitle', () => {
  it('sets the document title', () => {
    render(
      <DocumentTitleManager>
        <SentryDocumentTitle title="This is a test" />
      </DocumentTitleManager>
    );
    expect(document.title).toBe('This is a test — Sentry');
  });

  it('adds a organization slug', () => {
    render(
      <DocumentTitleManager>
        <SentryDocumentTitle orgSlug="org" title="This is a test" />
      </DocumentTitleManager>
    );
    expect(document.title).toBe('This is a test — org — Sentry');
  });

  it('adds a project slug', () => {
    render(
      <DocumentTitleManager>
        <SentryDocumentTitle projectSlug="project" title="This is a test" />
      </DocumentTitleManager>
    );
    expect(document.title).toBe('This is a test — project — Sentry');
  });

  it('adds a organization and project slug', () => {
    render(
      <DocumentTitleManager>
        <SentryDocumentTitle orgSlug="org" projectSlug="project" title="This is a test" />
      </DocumentTitleManager>
    );
    expect(document.title).toBe('This is a test — org — project — Sentry');
  });

  it('sets the title without suffix', () => {
    render(
      <DocumentTitleManager>
        <SentryDocumentTitle title="This is a test" noSuffix />
      </DocumentTitleManager>
    );
    expect(document.title).toBe('This is a test');
  });

  it('prepends and clears prefixes registered via setPrefix', () => {
    const {result} = renderHook(() => useDocumentTitleManager(), {
      wrapper: ({children}) => (
        <DocumentTitleManager>
          <SentryDocumentTitle title="page">{children}</SentryDocumentTitle>
        </DocumentTitleManager>
      ),
    });

    expect(document.title).toBe('page — Sentry');

    act(() => result.current.setPrefix('badge', '(2) '));
    expect(document.title).toBe('(2) page — Sentry');

    act(() => result.current.setPrefix('badge', ''));
    expect(document.title).toBe('page — Sentry');
  });

  it('reverts to the parent title', () => {
    const {rerender} = render(
      <DocumentTitleManager>
        <SentryDocumentTitle title="This is a test">
          <SentryDocumentTitle title="child title">Content</SentryDocumentTitle>
        </SentryDocumentTitle>
      </DocumentTitleManager>
    );

    expect(document.title).toBe('child title — Sentry');

    rerender(
      <DocumentTitleManager>
        <SentryDocumentTitle title="This is a test">new Content</SentryDocumentTitle>
      </DocumentTitleManager>
    );

    expect(document.title).toBe('This is a test — Sentry');
  });
});
