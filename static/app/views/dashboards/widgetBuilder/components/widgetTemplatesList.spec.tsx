import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import WidgetTemplatesList from 'sentry/views/dashboards/widgetBuilder/components/widgetTemplatesList';

jest.mock('sentry/actionCreators/indicator');

describe('WidgetTemplatesList', () => {
  const onSave = jest.fn();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/widgets/',
      method: 'POST',
      body: {},
      statusCode: 400,
    });
  });

  it('should render the widget templates list', async () => {
    render(<WidgetTemplatesList onSave={onSave} />);

    expect(await screen.findByText('Duration Distribution')).toBeInTheDocument();
    expect(
      await screen.findByText(
        'Compare transaction durations across different percentiles.'
      )
    ).toBeInTheDocument();
    expect(await screen.findByText('High Throughput Transactions')).toBeInTheDocument();
    expect(
      await screen.findByText('Top 5 transactions with the largest volume.')
    ).toBeInTheDocument();
  });

  it('should render buttons when the user clicks on a widget template', async () => {
    render(<WidgetTemplatesList onSave={onSave} />);

    const widgetTemplate = await screen.findByText('Duration Distribution');
    await userEvent.click(widgetTemplate);

    expect(await screen.findByText('Customize')).toBeInTheDocument();
    expect(await screen.findByText('Add to dashboard')).toBeInTheDocument();
  });

  it('should show error message when the widget fails to save', async () => {
    render(<WidgetTemplatesList onSave={onSave} />);

    const widgetTemplate = await screen.findByText('Duration Distribution');
    await userEvent.click(widgetTemplate);

    await userEvent.click(await screen.findByText('Add to dashboard'));

    await waitFor(() => {
      expect(addErrorMessage).toHaveBeenCalledWith('Unable to add widget');
    });

    // show we're still on the widget templates list
    expect(await screen.findByText('Add to dashboard')).toBeInTheDocument();
  });
});
