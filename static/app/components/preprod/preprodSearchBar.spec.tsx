import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {PreprodSearchBar} from 'sentry/components/preprod/preprodSearchBar';

jest.mock('sentry/views/explore/components/traceItemSearchQueryBuilder', () => {
  const actual = jest.requireActual(
    'sentry/views/explore/components/traceItemSearchQueryBuilder'
  );

  return {
    ...actual,
    TraceItemSearchQueryBuilder: (props: {
      arrayAttributes?: Record<string, unknown>;
      stringAttributes?: Record<string, unknown>;
    }) => (
      <div
        data-array-attributes={Object.keys(props.arrayAttributes ?? {}).join(',')}
        data-string-attributes={Object.keys(props.stringAttributes ?? {}).join(',')}
        data-test-id="preprod-search"
      />
    ),
  };
});

describe('PreprodSearchBar', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('threads array attributes through to the search builder', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [
        {key: 'app.name', name: 'app.name', attributeType: 'string'},
        {
          key: 'tags[app.features,array]',
          name: 'app.features',
          attributeType: 'array',
        },
      ],
    });

    render(<PreprodSearchBar initialQuery="" projects={[1]} />, {
      organization: OrganizationFixture({
        features: ['trace-item-array-query-support'],
      }),
    });

    await waitFor(() => {
      expect(screen.getByTestId('preprod-search')).toHaveAttribute(
        'data-array-attributes',
        expect.stringContaining('tags[app.features,array]')
      );
    });
  });

  it('gates out array attributes when the flag is disabled', async () => {
    // Even if array attributes come back, the local flag guard drops them.
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [
        {key: 'app.name', name: 'app.name', attributeType: 'string'},
        {
          key: 'tags[app.features,array]',
          name: 'app.features',
          attributeType: 'array',
        },
      ],
    });

    render(<PreprodSearchBar initialQuery="" projects={[1]} />, {
      organization: OrganizationFixture(),
    });

    await waitFor(() => {
      expect(screen.getByTestId('preprod-search')).toHaveAttribute(
        'data-string-attributes',
        expect.stringContaining('app.name')
      );
    });
    expect(screen.getByTestId('preprod-search')).toHaveAttribute(
      'data-array-attributes',
      ''
    );
  });
});
