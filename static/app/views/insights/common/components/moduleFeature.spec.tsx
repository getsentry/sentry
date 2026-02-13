import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ModuleFeature} from 'sentry/views/insights/common/components/moduleFeature';
import {ModuleName} from 'sentry/views/insights/types';

jest.mock('sentry/components/pageFilters/usePageFilters');

describe('ModulePageProviders', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders no feature if module is not enabled', async () => {
    render(
      <ModuleFeature moduleName={ModuleName.DB}>
        <div>Module Content</div>
      </ModuleFeature>,
      {
        organization: OrganizationFixture({
          features: [''],
        }),
      }
    );

    await screen.findByText(`You don't have access to this feature`);
  });

  it('renders module content if module is enabled', async () => {
    render(
      <ModuleFeature moduleName={ModuleName.DB}>
        <div>Module Content</div>
      </ModuleFeature>,
      {
        organization: OrganizationFixture({
          features: ['insight-modules'],
        }),
      }
    );

    await screen.findByText(`Module Content`);
  });
});
