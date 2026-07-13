import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  WIZARD_STORAGE_KEY,
  type WizardState,
  useScmCreateProjectProductSync,
} from 'sentry/views/projectInstall/scmCreateProjectSession';

const CREATED_PROJECT_SLUG = 'my-project';

function seedSession(overrides: Partial<WizardState> = {}) {
  window.sessionStorage.setItem(
    WIZARD_STORAGE_KEY,
    JSON.stringify({
      createdProjectId: '1',
      createdProjectSlug: CREATED_PROJECT_SLUG,
      selectedFeatures: [ProductSolution.ERROR_MONITORING],
      selectedPlatform: undefined,
      selectedIntegration: undefined,
      selectedRepository: undefined,
      projectDetailsForm: undefined,
      ...overrides,
    })
  );
}

function readSession(): WizardState | null {
  const raw = window.sessionStorage.getItem(WIZARD_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

describe('useScmCreateProjectProductSync', () => {
  const project = ProjectFixture({slug: CREATED_PROJECT_SLUG});

  afterEach(() => {
    window.sessionStorage.clear();
    jest.clearAllMocks();
  });

  it('returns a callback when the flag is on and the session matches the project', () => {
    seedSession();

    const {result} = renderHookWithProviders(
      () => useScmCreateProjectProductSync(project),
      {
        organization: {features: ['onboarding-scm-project-creation-experiment']},
      }
    );

    expect(result.current).toBeInstanceOf(Function);
  });

  it('calling the callback patches selectedFeatures while preserving other session fields', () => {
    seedSession({
      selectedFeatures: [ProductSolution.ERROR_MONITORING],
      projectDetailsForm: {projectName: 'my-project'},
    });

    const {result} = renderHookWithProviders(
      () => useScmCreateProjectProductSync(project),
      {
        organization: {features: ['onboarding-scm-project-creation-experiment']},
      }
    );

    act(() => {
      result.current?.([
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.SESSION_REPLAY,
      ]);
    });

    const saved = readSession();
    expect(saved?.selectedFeatures).toEqual([
      ProductSolution.PERFORMANCE_MONITORING,
      ProductSolution.SESSION_REPLAY,
    ]);
    // Other fields are preserved.
    expect(saved?.createdProjectSlug).toBe(CREATED_PROJECT_SLUG);
    expect(saved?.projectDetailsForm?.projectName).toBe('my-project');
  });

  it('returns undefined when the session project does not match', () => {
    seedSession({createdProjectSlug: 'different-project'});

    const {result} = renderHookWithProviders(
      () => useScmCreateProjectProductSync(project),
      {
        organization: {features: ['onboarding-scm-project-creation-experiment']},
      }
    );

    expect(result.current).toBeUndefined();
  });

  it('returns undefined when the SCM experiment flag is off', () => {
    seedSession();

    const {result} = renderHookWithProviders(
      () => useScmCreateProjectProductSync(project),
      {
        // No experiment feature in org features list.
        organization: {features: []},
      }
    );

    expect(result.current).toBeUndefined();
  });

  it('returns undefined when no session is present', () => {
    // No session seeded.
    const {result} = renderHookWithProviders(
      () => useScmCreateProjectProductSync(project),
      {
        organization: {features: ['onboarding-scm-project-creation-experiment']},
      }
    );

    expect(result.current).toBeUndefined();
  });
});
