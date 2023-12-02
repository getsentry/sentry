import {GroupStats} from 'sentry-fixture/groupStats';
import {Organization} from 'sentry-fixture/organization';
import {PageFilters} from 'sentry-fixture/pageFilters';

import {render} from 'sentry-test/reactTestingLibrary';

import {GroupStatsProvider} from 'sentry/views/issueList/groupStatsProvider';

describe('GroupStatsProvider', () => {
  it('doesnt send request if list of groupIds is empty', () => {
    const organization = Organization();

    const statsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-stats/',
      body: [],
    });

    render(
      <GroupStatsProvider
        organization={organization}
        selection={PageFilters()}
        period="24h"
        groupIds={[]}
      >
        {null}
      </GroupStatsProvider>
    );

    expect(statsMock).not.toHaveBeenCalled();
  });

  it('sends request for list of groups', () => {
    const selection = PageFilters();
    const organization = Organization();

    const statsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-stats/',
      body: [],
    });

    render(
      <GroupStatsProvider
        organization={organization}
        selection={selection}
        period="24h"
        groupIds={['1', '2', '3']}
      >
        {null}
      </GroupStatsProvider>
    );

    expect(statsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          groups: ['1', '2', '3'],
        }),
      })
    );
  });

  it('cached groups are not requested twice', async () => {
    const selection = PageFilters();
    const organization = Organization();

    const firstRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-stats/',
      body: [GroupStats({id: '1'}), GroupStats({id: '2'}), GroupStats({id: '3'})],
    });

    const {rerender} = render(
      <GroupStatsProvider
        organization={organization}
        selection={selection}
        period="24h"
        groupIds={['1', '2', '3']}
      >
        {null}
      </GroupStatsProvider>
    );

    expect(firstRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          groups: ['1', '2', '3'],
        }),
      })
    );

    // Tick and allow promises to resolve
    await tick();

    const secondRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-stats/',
      body: [GroupStats({id: '4'}), GroupStats({id: '5'})],
    });

    rerender(
      <GroupStatsProvider
        organization={organization}
        selection={selection}
        period="24h"
        groupIds={['1', '4', '5']}
      >
        {null}
      </GroupStatsProvider>
    );

    expect(secondRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          groups: ['4', '5'],
        }),
      })
    );
  });

  it('cached groups are requested twice if params change', async () => {
    const selection = PageFilters();
    const organization = Organization();

    const firstRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-stats/',
      body: [GroupStats({id: '1'}), GroupStats({id: '2'}), GroupStats({id: '3'})],
    });

    const {rerender} = render(
      <GroupStatsProvider
        organization={organization}
        selection={selection}
        period="24h"
        groupIds={['1', '2', '3']}
      >
        {null}
      </GroupStatsProvider>
    );

    expect(firstRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          groups: ['1', '2', '3'],
        }),
      })
    );

    // Tick and allow promises to resolve
    await tick();

    const secondRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-stats/',
      body: [GroupStats({id: '1'}), GroupStats({id: '2'}), GroupStats({id: '3'})],
    });

    rerender(
      <GroupStatsProvider
        organization={organization}
        selection={selection}
        period="12h"
        groupIds={['1', '2', '3']}
      >
        {null}
      </GroupStatsProvider>
    );

    expect(secondRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          groups: ['1', '2', '3'],
        }),
      })
    );
  });
});
