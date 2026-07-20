import {sessionStorageWrapper} from 'sentry/utils/sessionStorage';
import {
  PROJECT_CREATION_ORIGIN_ORG_CREATION,
  PROJECT_CREATION_ORIGIN_QUERY_KEY,
  resolveProjectCreationPageOrigin,
} from 'sentry/views/projectInstall/projectCreationOrigin';

describe('resolveProjectCreationPageOrigin', () => {
  beforeEach(() => {
    sessionStorageWrapper.clear();
  });

  it('seeds storage and returns org_creation from the query param', () => {
    expect(
      resolveProjectCreationPageOrigin({
        orgSlug: 'acme',
        queryValue: PROJECT_CREATION_ORIGIN_ORG_CREATION,
      })
    ).toBe('org_creation');

    expect(sessionStorageWrapper.getItem('project-creation-origin:acme')).toBe(
      PROJECT_CREATION_ORIGIN_ORG_CREATION
    );
  });

  it('returns sticky org_creation after the seed is gone (e.g. autofill back)', () => {
    resolveProjectCreationPageOrigin({
      orgSlug: 'acme',
      queryValue: PROJECT_CREATION_ORIGIN_ORG_CREATION,
    });

    expect(
      resolveProjectCreationPageOrigin({
        orgSlug: 'acme',
        // Getting-started back only sets referrer — no origin seed.
        queryValue: undefined,
      })
    ).toBe('org_creation');
  });

  it('defaults to existing_org with no seed and empty storage', () => {
    expect(
      resolveProjectCreationPageOrigin({
        orgSlug: 'acme',
        queryValue: undefined,
      })
    ).toBe('existing_org');
  });

  it('does not treat other query values as org creation', () => {
    expect(
      resolveProjectCreationPageOrigin({
        orgSlug: 'acme',
        queryValue: 'getting-started',
      })
    ).toBe('existing_org');
  });

  it('scopes sticky origin per org slug', () => {
    resolveProjectCreationPageOrigin({
      orgSlug: 'acme',
      queryValue: PROJECT_CREATION_ORIGIN_ORG_CREATION,
    });

    expect(
      resolveProjectCreationPageOrigin({
        orgSlug: 'other-org',
        queryValue: undefined,
      })
    ).toBe('existing_org');
  });

  it('exports the query key used by org-create redirect', () => {
    // Guard against silent drift between the redirect builder and the reader.
    expect(PROJECT_CREATION_ORIGIN_QUERY_KEY).toBe('projectCreationOrigin');
  });
});
