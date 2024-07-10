import * as Sentry from '@sentry/react';
import {uuid4} from '@sentry/utils';
import * as qs from 'query-string';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';

import ContinuosProfileProvider from './continuousProfileProvider';

describe('ContinuousProfileProvider', () => {
  beforeEach(() => {
    window.location.search = '';
    MockApiClient.clearMockResponses();
  });
  it('fetches chunk', async () => {
    const project = ProjectFixture();
    const organization = OrganizationFixture();
    ProjectsStore.loadInitialData([project]);

    window.location.search = qs.stringify({
      start: new Date().toISOString(),
      end: new Date().toISOString(),
      profilerId: uuid4(),
    });

    const captureMessage = jest.spyOn(Sentry, 'captureMessage');
    const chunkRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/profiling/chunks/`,
      body: {},
    });

    render(<ContinuosProfileProvider>{null}</ContinuosProfileProvider>, {
      router: {
        params: {orgId: organization.slug, projectId: project.slug},
      },
      organization,
    });

    await waitFor(() => expect(chunkRequest).toHaveBeenCalled());
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it('requires start, end and profilerId', async () => {
    for (const [start, end, profilerId] of [
      [undefined, new Date().toISOString(), uuid4()],
      [new Date().toISOString(), undefined, uuid4()],
      [new Date().toISOString(), new Date().toISOString(), undefined],
    ]) {
      window.location.search = qs.stringify({start, end, profilerId});
      const captureMessage = jest.spyOn(Sentry, 'captureMessage');
      render(<ContinuosProfileProvider>{null}</ContinuosProfileProvider>, {
        router: {
          params: {orgId: OrganizationFixture().slug, projectId: ProjectFixture().slug},
        },
        organization: OrganizationFixture(),
      });

      await waitFor(() =>
        expect(captureMessage).toHaveBeenCalledWith(
          expect.stringContaining(
            'Failed to fetch continuous profile - invalid query parameters.'
          )
        )
      );
    }
  });
});
