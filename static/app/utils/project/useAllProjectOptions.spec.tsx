import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectOptionFixture} from 'sentry-fixture/projectOptionFixture';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import useAllProjectOptions from 'sentry/utils/project/useAllProjectOptions';
import type {QueryClient} from 'sentry/utils/queryClient';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {getPaginationPageLink} from 'sentry/views/organizationStats/utils';

jest.mock('sentry/utils/useOrganization');

function makeWrapper(queryClient: QueryClient) {
  return function wrapper({children}: {children?: ReactNode}) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useAllProjectOptions', () => {
  const mockOrg = OrganizationFixture();
  jest.mocked(useOrganization).mockReturnValue(mockOrg);

  const MOCK_API_ENDPOINT = `/organizations/${mockOrg.slug}/projects/`;

  const project10 = ProjectFixture({id: '10', slug: 'ten'});
  const project11 = ProjectFixture({id: '11', slug: 'eleven'});
  const project20 = ProjectFixture({id: '20', slug: 'twenty'});
  const project21 = ProjectFixture({id: '21', slug: 'twenty one'});
  const project10Option = ProjectOptionFixture(project10);
  const project11Option = ProjectOptionFixture(project11);
  const project20Option = ProjectOptionFixture(project20);
  const project21Option = ProjectOptionFixture(project21);

  it('should return a list of all projects', async () => {
    const firstPage = MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: [project10, project11],
      match: [MockApiClient.matchQuery({cursor: '0:0:0', per_page: 100})],
      headers: {Link: getPaginationPageLink({numRows: 130, pageSize: 100, offset: 0})},
    });
    const secondPage = MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: [project20, project21],
      match: [MockApiClient.matchQuery({cursor: '0:100:0', per_page: 100})],
      headers: {Link: getPaginationPageLink({numRows: 130, pageSize: 100, offset: 100})},
    });

    const {result, waitFor} = reactHooks.renderHook(useAllProjectOptions, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {},
    });

    expect(result.current.isFetching).toBeTruthy();
    expect(result.current.projects).toEqual([]);

    await waitFor(() => expect(result.current.isFetching).toBeFalsy());
    expect(result.current.projects).toEqual([
      project10Option,
      project11Option,
      project20Option,
      project21Option,
    ]);
    expect(firstPage).toHaveBeenCalled();
    expect(secondPage).toHaveBeenCalled();
  });

  it('should return a getters by id & slug, for quick reference', async () => {
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: [project10, project11],
      match: [MockApiClient.matchQuery({cursor: '0:0:0', per_page: 100})],
      headers: {Link: getPaginationPageLink({numRows: 130, pageSize: 100, offset: 0})},
    });
    MockApiClient.addMockResponse({
      url: MOCK_API_ENDPOINT,
      body: [project20, project21],
      match: [MockApiClient.matchQuery({cursor: '0:100:0', per_page: 100})],
      headers: {Link: getPaginationPageLink({numRows: 130, pageSize: 100, offset: 100})},
    });

    const {result, waitFor} = reactHooks.renderHook(useAllProjectOptions, {
      wrapper: makeWrapper(makeTestQueryClient()),
      initialProps: {},
    });

    await waitFor(() => expect(result.current.isFetching).toBeFalsy());

    expect(result.current.getById('10')).toEqual(project10Option);
    expect(result.current.getById('11')).toEqual(project11Option);
    expect(result.current.getById('20')).toEqual(project20Option);
    expect(result.current.getById('21')).toEqual(project21Option);

    expect(result.current.getBySlug('ten')).toEqual(project10Option);
    expect(result.current.getBySlug('eleven')).toEqual(project11Option);
    expect(result.current.getBySlug('twenty')).toEqual(project20Option);
    expect(result.current.getBySlug('twenty one')).toEqual(project21Option);
  });
});
