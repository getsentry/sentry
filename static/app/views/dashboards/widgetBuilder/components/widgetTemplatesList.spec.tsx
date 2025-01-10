import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import WidgetTemplatesList from 'sentry/views/dashboards/widgetBuilder/components/widgetTemplatesList';

describe('WidgetTemplatesList', () => {
  it('should render the widget templates list', async () => {
    render(<WidgetTemplatesList />);

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
    render(<WidgetTemplatesList />);

    const widgetTemplate = await screen.findByText('Duration Distribution');
    await userEvent.click(widgetTemplate);

    expect(await screen.findByText('Customize')).toBeInTheDocument();
    expect(await screen.findByText('Add to dashboard')).toBeInTheDocument();
  });
});
