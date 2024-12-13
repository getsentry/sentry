import {render, screen} from 'sentry-test/reactTestingLibrary';

import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';
import {WidgetType} from 'sentry/views/dashboards/types';
import WidgetBuilderQueryFilterBuilder from 'sentry/views/dashboards/widgetBuilder/components/queryFilterBuilder';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import useWidgetBuilderState from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';

jest.mock('sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState');
jest.mock('sentry/utils/useCustomMeasurements');
jest.mock('sentry/views/explore/contexts/spanTagsContext');

describe('QueryFilterBuilder', () => {
  beforeEach(() => {
    jest.mocked(useWidgetBuilderState).mockReturnValue({
      dispatch: jest.fn(),
      state: {dataset: WidgetType.ERRORS},
    });
    jest.mocked(useCustomMeasurements).mockReturnValue({
      customMeasurements: {},
    });
    jest.mocked(useSpanTags).mockReturnValue({});

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
    });
  });

  it('renders a dataset-specific query filter bar', async () => {
    const {rerender} = render(
      <WidgetBuilderProvider>
        <WidgetBuilderQueryFilterBuilder onQueryConditionChange={() => {}} />
      </WidgetBuilderProvider>
    );
    expect(
      await screen.findByPlaceholderText('Search for events, users, tags, and more')
    ).toBeInTheDocument();

    jest.mocked(useWidgetBuilderState).mockReturnValue({
      dispatch: jest.fn(),
      state: {dataset: WidgetType.SPANS},
    });

    rerender(
      <WidgetBuilderProvider>
        <WidgetBuilderQueryFilterBuilder onQueryConditionChange={() => {}} />
      </WidgetBuilderProvider>
    );
    expect(
      await screen.findByPlaceholderText('Search for spans, users, tags, and more')
    ).toBeInTheDocument();
  });
});
