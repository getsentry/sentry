import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/utils/usePageFilters';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {useHasFirstSpan} from 'sentry/views/insights/common/queries/useHasFirstSpan';
import {ModuleName} from 'sentry/views/insights/types';

vi.mock('sentry/utils/usePageFilters');
vi.mock('sentry/views/insights/common/queries/useHasFirstSpan');
vi.mock('sentry/views/insights/common/utils/useHasDataTrackAnalytics');

describe('ModulePageProviders', () => {
  beforeEach(() => {
    vi.mocked(usePageFilters).mockReturnValue({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      shouldPersist: true,
      selection: {
        datetime: {
          period: '10d',
          start: null,
          end: null,
          utc: false,
        },
        environments: [],
        projects: [2],
      },
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders without module feature', async () => {
    vi.mocked(useHasFirstSpan).mockReturnValue(true);

    render(
      <ModulePageProviders moduleName={ModuleName.DB}>
        <div>Module Content</div>
      </ModulePageProviders>,
      {
        organization: OrganizationFixture(),
      }
    );

    await screen.findByText('Module Content');
  });
});
