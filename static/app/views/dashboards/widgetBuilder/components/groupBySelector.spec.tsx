import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useNavigate} from 'sentry/utils/useNavigate';
import WidgetBuilderGroupBySelector from 'sentry/views/dashboards/widgetBuilder/components/groupBySelector';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {SpanTagsProvider} from 'sentry/views/explore/contexts/spanTagsContext';

jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: jest.fn(),
}));

const mockUseNavigate = jest.mocked(useNavigate);

describe('WidgetBuilderGroupBySelector', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/spans/fields/',
      body: [],
    });
  });

  it('renders', async function () {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(
      <WidgetBuilderProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <WidgetBuilderGroupBySelector />
        </SpanTagsProvider>
      </WidgetBuilderProvider>
    );

    expect(await screen.findByText('Group by')).toBeInTheDocument();
    expect(await screen.findByText('Select group')).toBeInTheDocument();
    expect(await screen.findByText('Add Group')).toBeInTheDocument();
  });

  it('renders the group by field and can function', async function () {
    render(
      <WidgetBuilderProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <WidgetBuilderGroupBySelector />
        </SpanTagsProvider>
      </WidgetBuilderProvider>
    );

    expect(await screen.findByText('Group by')).toBeInTheDocument();
    expect(await screen.findByText('Select group')).toBeInTheDocument();
    expect(await screen.findByText('Add Group')).toBeInTheDocument();

    await userEvent.click(await screen.findByText('Select group'));
    await userEvent.click(await screen.findByText('timestamp'));

    await userEvent.click(await screen.findByText('Add Group'));
    await userEvent.click(await screen.findByText('Select group'));
    await userEvent.click(await screen.findByText('id'));

    expect(await screen.findAllByLabelText('Remove group')).toHaveLength(2);

    await userEvent.click((await screen.findAllByLabelText('Remove group'))[0]!);

    expect(await screen.findByText('id')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('timestamp')).not.toBeInTheDocument();
    });
  });
});
