import {useQueryClient} from '@tanstack/react-query';
import {EventAttachmentFixture} from 'sentry-fixture/eventAttachment';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import type {IssueAttachment} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';

import {doEventsRequest, useDeleteEventAttachmentOptimistic} from './events';

describe('Events ActionCreator', () => {
  const api = new MockApiClient();
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const opts = {
    organization,
    project: [parseInt(project.id, 10)],
    environment: [],
  };

  let mock: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [
          [123, []],
          [123, []],
          [123, []],
          [123, []],
          [123, []],
          [123, []],
        ],
      },
    });
  });

  it('requests events stats with relative period', async () => {
    await doEventsRequest<false>(api, {
      ...opts,
      includeAllArgs: false,
      includePrevious: false,
      period: '7d',
      partial: true,
    });

    expect(mock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          project: [parseInt(project.id, 10)],
          environment: [],
          statsPeriod: '7d',
        }),
      })
    );
  });

  it('requests events stats with relative period including previous period', async () => {
    await doEventsRequest<false>(api, {
      ...opts,
      includeAllArgs: false,
      includePrevious: true,
      period: '7d',
      partial: true,
    });

    expect(mock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          project: [parseInt(project.id, 10)],
          environment: [],
          statsPeriod: '14d',
        }),
      })
    );
  });

  it('requests events stats with absolute period', async () => {
    const start = new Date('2017-10-12T12:00:00.000Z');
    const end = new Date('2017-10-17T00:00:00.000Z');
    await doEventsRequest<false>(api, {
      ...opts,
      includeAllArgs: false,
      includePrevious: false,
      start,
      end,
      partial: true,
    });

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          project: [parseInt(project.id, 10)],
          environment: [],
          start: '2017-10-12T12:00:00',
          end: '2017-10-17T00:00:00',
        }),
      })
    );
  });

  it('requests events stats with absolute period including previous period', async () => {
    const start = new Date('2017-10-12T12:00:00.000Z');
    const end = new Date('2017-10-17T00:00:00.000Z');
    await doEventsRequest<false>(api, {
      ...opts,
      includeAllArgs: false,
      includePrevious: true,
      start,
      end,
      partial: true,
    });

    expect(mock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          project: [parseInt(project.id, 10)],
          environment: [],
          start: '2017-10-08T00:00:00',
          end: '2017-10-17T00:00:00',
        }),
      })
    );
  });

  it('spreads query extras', async () => {
    await doEventsRequest<false>(api, {
      ...opts,
      includeAllArgs: false,
      queryExtras: {useOnDemandMetrics: 'true'},
      partial: true,
    });

    expect(mock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          project: [parseInt(project.id, 10)],
          environment: [],
          useOnDemandMetrics: 'true',
        }),
      })
    );
  });
});

describe('attachment deletion cache', () => {
  const params = {orgSlug: 'org-slug', projectSlug: 'project-slug', eventId: 'event-id'};
  const options = apiOptions.as<IssueAttachment[]>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/attachments/',
    {
      path: {
        organizationIdOrSlug: params.orgSlug,
        projectIdOrSlug: params.projectSlug,
        eventId: params.eventId,
      },
      staleTime: Infinity,
    }
  );

  afterEach(() => MockApiClient.clearMockResponses());

  it.each([200, 500])(
    'preserves response metadata on deletion with status %s',
    async statusCode => {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/events/event-id/attachments/1/',
        method: 'DELETE',
        statusCode,
      });
      const {result} = renderHookWithProviders(() => ({
        mutation: useDeleteEventAttachmentOptimistic(),
        client: useQueryClient(),
      }));
      const attachments = [
        EventAttachmentFixture({id: '1'}),
        EventAttachmentFixture({id: '2'}),
      ];
      const previous = {json: attachments, headers: {Link: 'next-page'}, status: 200};
      result.current.client.setQueryData(options.queryKey, previous);
      await act(async () => {
        await result.current.mutation
          .mutateAsync({...params, attachmentId: '1'})
          .catch(() => null);
      });
      expect(result.current.client.getQueryData(options.queryKey)).toEqual({
        ...previous,
        json: statusCode === 200 ? [attachments[1]] : attachments,
      });
      expect(previous.json).toEqual(attachments);
      expect(previous.json).toHaveLength(2);
    }
  );

  it('does not create a response when the attachments are absent from cache', async () => {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/events/event-id/attachments/1/',
      method: 'DELETE',
    });
    const {result} = renderHookWithProviders(() => ({
      mutation: useDeleteEventAttachmentOptimistic(),
      client: useQueryClient(),
    }));
    await act(async () => {
      await result.current.mutation.mutateAsync({...params, attachmentId: '1'});
    });
    expect(result.current.client.getQueryData(options.queryKey)).toBeUndefined();
  });
});
