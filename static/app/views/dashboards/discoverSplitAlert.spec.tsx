import {WidgetFixture} from 'sentry-fixture/widget';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DatasetSource} from 'sentry/utils/discover/types';
import localStorage from 'sentry/utils/localStorage';
import {DiscoverSplitAlert} from 'sentry/views/dashboards/discoverSplitAlert';
import {WidgetType} from 'sentry/views/dashboards/types';

describe('DiscoverSplitAlert', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders if the widget has a forced split decision', async () => {
    render(
      <DiscoverSplitAlert
        widget={{
          ...WidgetFixture(),
          datasetSource: DatasetSource.FORCED,
          widgetType: WidgetType.ERRORS,
        }}
      />
    );

    await userEvent.hover(screen.getByLabelText('Dataset split warning'));

    expect(
      await screen.findByText(/We're splitting our datasets up/)
    ).toBeInTheDocument();
  });

  it('does not render if there the widget has not been forced', () => {
    render(<DiscoverSplitAlert widget={WidgetFixture()} />);

    expect(screen.queryByText(/We're splitting our datasets up/)).not.toBeInTheDocument();
  });
});
