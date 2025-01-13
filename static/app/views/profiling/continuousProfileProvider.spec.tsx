import * as Sentry from '@sentry/react';
import {uuid4} from '@sentry/utils';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';

import ContinuosProfileProvider from './continuousProfileProvider';

describe('ContinuousProfileProvider', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });
  it('fetches chunk', async () => {
    const {organization, project, router} = initializeOrg({
      router: {
        location: {
          query: {
            start: new Date().toISOString(),
            end: new Date().toISOString(),
            profilerId: uuid4(),
            eventId: '1',
          },
        },
      },
    });
    ProjectsStore.loadInitialData([project]);

    const captureMessage = jest.spyOn(Sentry, 'captureMessage');
    const chunkRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/profiling/chunks/`,
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/1/`,
      body: {},
    });

    render(<ContinuosProfileProvider>{null}</ContinuosProfileProvider>, {
      router,
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
      const {organization, project, router} = initializeOrg({
        // params: {orgId: organization.slug, projectId: project.slug},
        router: {
          location: {
            query: {
              start,
              end,
              profilerId,
              eventId: '1',
            },
          },
        },
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/events/1/`,
        body: {},
      });
      const captureMessage = jest.spyOn(Sentry, 'captureMessage');
      render(<ContinuosProfileProvider>{null}</ContinuosProfileProvider>, {
        router,
        organization,
      });

      await waitFor(() =>
        expect(captureMessage).toHaveBeenCalledWith(
          expect.stringContaining(
            'Failed to fetch continuous profile - invalid chunk parameters.'
          )
        )
      );
    }
  });
});
