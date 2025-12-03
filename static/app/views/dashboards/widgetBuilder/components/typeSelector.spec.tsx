import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useNavigate} from 'sentry/utils/useNavigate';
import {WidgetType} from 'sentry/views/dashboards/types';
import TypeSelector from 'sentry/views/dashboards/widgetBuilder/components/typeSelector';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: jest.fn(),
}));

const mockUseNavigate = jest.mocked(useNavigate);

describe('TypeSelector', () => {
  it('changes the visualization type', async () => {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(
      <WidgetBuilderProvider>
        <TypeSelector />
      </WidgetBuilderProvider>
    );

    // click dropdown
    await userEvent.click(await screen.findByText('Table'));
    // select new option
    await userEvent.click(await screen.findByText('Bar'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({displayType: 'bar'}),
      }),
      expect.anything()
    );
  });

  it('displays error message when there is an error', async () => {
    render(
      <WidgetBuilderProvider>
        <TypeSelector error={{displayType: 'Please select a type'}} />
      </WidgetBuilderProvider>
    );

    expect(await screen.findByText('Please select a type')).toBeInTheDocument();
  });

  it('resets the widget builder state when the display type is changed on an issue widget', async () => {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(
      <WidgetBuilderProvider>
        <TypeSelector />
      </WidgetBuilderProvider>,
      {
        organization: {
          features: ['dashboards-issue-widget-series-display-type'],
        },
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/dashboard/1/',
            query: {displayType: 'line', dataset: WidgetType.ISSUE},
          },
        },
      }
    );

    await userEvent.click(await screen.findByText('Line'));
    await userEvent.click(await screen.findByText('Table'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          displayType: 'table',
        }),
      }),
      expect.anything()
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: WidgetType.ISSUE,
        }),
      }),
      expect.anything()
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          field: ['issue', 'assignee', 'title'],
        }),
      }),
      expect.anything()
    );
  });
});
