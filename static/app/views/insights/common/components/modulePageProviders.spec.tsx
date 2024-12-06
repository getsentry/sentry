import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/utils/usePageFilters';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {useHasFirstSpan} from 'sentry/views/insights/common/queries/useHasFirstSpan';
import {ModuleName} from 'sentry/views/insights/types';

jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/views/insights/common/queries/useHasFirstSpan');
jest.mock('sentry/views/insights/common/utils/useHasDataTrackAnalytics');

describe('ModulePageProviders', () => {
  beforeEach(() => {
    jest.mocked(usePageFilters).mockReturnValue({
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
    jest.resetAllMocks();
  });

  it('renders without module feature', async () => {
    jest.mocked(useHasFirstSpan).mockReturnValue(true);

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
