import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from './projectsStore';
import {useLegacyStore} from './useLegacyStore';

describe('useLegacyStore', () => {
  const project = ProjectFixture();

  beforeEach(() => ProjectsStore.reset());

  it('should update on change to store', () => {
    const {result} = renderHook(useLegacyStore, {initialProps: ProjectsStore});

    expect(result.current.projects).toEqual([]);

    act(() => ProjectsStore.loadInitialData([project]));

    expect(result.current.projects).toEqual([project]);
  });
});
