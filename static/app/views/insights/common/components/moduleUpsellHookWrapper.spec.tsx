import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {ModuleName} from 'sentry/views/insights/types';

vi.mock('sentry/utils/usePageFilters');

describe('ModulePageProviders', () => {
  afterEach(() => {
    vi.resetAllMocks();
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

  it('renders module content if module is enabled', async () => {
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
