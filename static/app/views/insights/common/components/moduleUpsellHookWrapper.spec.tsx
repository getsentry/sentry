import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {ModuleName} from 'sentry/views/insights/types';

jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/views/insights/common/utils/useHasDataTrackAnalytics');

describe('ModulePageProviders', () => {
  // beforeEach(() => {
  // });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders no feature if module is not enabled', async () => {
    render(
      <ModuleBodyUpsellHook moduleName={ModuleName.DB}>
        <div>Module Content</div>
      </ModuleBodyUpsellHook>,
      {
        organization: OrganizationFixture({
          features: ['insights-entry-points'],
        }),
      }
    );

    await screen.findByText(`You don't have access to this feature`);
  });

  it('renders module content if feature is module feature is available', async () => {
    render(
      <ModuleBodyUpsellHook moduleName={ModuleName.DB}>
        <div>Module Content</div>
      </ModuleBodyUpsellHook>,
      {
        organization: OrganizationFixture({
          features: ['insights-initial-modules'],
        }),
      }
    );

    await screen.findByText(`Module Content`);
  });
});
