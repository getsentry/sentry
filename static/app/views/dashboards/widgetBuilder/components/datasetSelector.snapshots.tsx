import {OrganizationFixture} from 'sentry-fixture/organization';

import {CompactSelect as mockCompactSelect} from 'sentry-test/snapshots/mocks/compactSelect';

import {Container} from '@sentry/scraps/layout';

import {OrganizationContext} from 'sentry/utils/organizationContext';
import {WidgetType} from 'sentry/views/dashboards/types';

jest.mock('@sentry/scraps/compactSelect', () => ({
  CompactSelect: mockCompactSelect,
}));
// SSR snapshot tests have no router, so the URL-backed builder state is stubbed.
jest.mock('sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext', () => ({
  useWidgetBuilderContext: () => ({
    state: {dataset: WidgetType.SPANS},
    dispatch: () => {},
  }),
}));
jest.mock('sentry/views/dashboards/widgetBuilder/hooks/useCacheBuilderState', () => ({
  useCacheBuilderState: () => ({
    cacheBuilderState: () => {},
    restoreOrSetBuilderState: () => {},
  }),
}));
jest.mock('sentry/views/dashboards/widgetBuilder/hooks/useDashboardWidgetSource', () => ({
  useDashboardWidgetSource: () => {},
}));
jest.mock('sentry/views/dashboards/widgetBuilder/hooks/useIsEditingWidget', () => ({
  useIsEditingWidget: () => false,
}));

import {WidgetBuilderDatasetSelector} from './datasetSelector';

const organization = OrganizationFixture({features: ['visibility-explore-view']});

describe('WidgetBuilderDatasetSelector', () => {
  it.snapshot('section title and dataset select', () => (
    <OrganizationContext.Provider value={organization}>
      <Container padding="xl" width="400px">
        <WidgetBuilderDatasetSelector />
      </Container>
    </OrganizationContext.Provider>
  ));
});
