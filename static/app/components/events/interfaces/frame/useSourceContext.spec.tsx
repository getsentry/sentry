import {EventFixture} from 'sentry-fixture/event';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {SourceContextResponse} from 'sentry/components/events/interfaces/frame/useSourceContext';
import {useSourceContext} from 'sentry/components/events/interfaces/frame/useSourceContext';

describe('useSourceContext', () => {
  const project = ProjectFixture();
  const event = EventFixture({projectID: project.id});
  const frame = {
    filename: 'src/app.py',
    lineNo: 10,
    absPath: '/path/to/src/app.py',
    function: 'test_func',
    module: null,
    package: null,
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('fetches source context when enabled', async () => {
    const mockResponse: SourceContextResponse = {
      context: [
        [8, 'def helper():'],
        [9, '    pass'],
        [10, 'def test_func():'],
        [11, '    return "result"'],
        [12, ''],
      ],
      sourceUrl: 'https://github.com/example/repo/blob/main/src/app.py',
      error: null,
    };

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/stacktrace-source-context/`,
      body: mockResponse,
    });

    const {result} = renderHookWithProviders(useSourceContext, {
      initialProps: {
        event,
        frame,
        orgSlug: 'org-slug',
        projectSlug: project.slug,
      },
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.context).toEqual(mockResponse.context);
    expect(result.current.data?.sourceUrl).toBe(mockResponse.sourceUrl);
    expect(result.current.data?.error).toBeNull();
  });

});
