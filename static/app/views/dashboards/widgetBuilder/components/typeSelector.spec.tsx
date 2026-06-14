import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {replaceUrlWithoutNavigation} from 'sentry/utils/url/replaceUrlWithoutNavigation';
import {WidgetType} from 'sentry/views/dashboards/types';
import {WidgetBuilderTypeSelector as TypeSelector} from 'sentry/views/dashboards/widgetBuilder/components/typeSelector';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

jest.mock('sentry/utils/url/replaceUrlWithoutNavigation');

const mockReplaceUrl = jest.mocked(replaceUrlWithoutNavigation);

describe('TypeSelector', () => {
  it('changes the visualization type', async () => {
    render(
      <WidgetBuilderProvider>
        <TypeSelector />
      </WidgetBuilderProvider>
    );

    // click dropdown
    await userEvent.click(await screen.findByText('Table'));
    // select new option
    await userEvent.click(await screen.findByText('Bar (Time Series)'));

    expect(mockReplaceUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({displayType: 'bar'}),
      })
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

  it('shows text widget option', async () => {
    render(
      <WidgetBuilderProvider>
        <TypeSelector />
      </WidgetBuilderProvider>,
      {
        organization: OrganizationFixture(),
      }
    );

    await userEvent.click(await screen.findByText('Table'));
    expect(screen.getByText('Text (Markdown)')).toBeInTheDocument();
  });

  it('resets the widget builder state when the display type is changed on an issue widget', async () => {
    render(
      <WidgetBuilderProvider>
        <TypeSelector />
      </WidgetBuilderProvider>,
      {
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

    expect(mockReplaceUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          displayType: 'table',
        }),
      })
    );
    expect(mockReplaceUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: WidgetType.ISSUE,
        }),
      })
    );
    expect(mockReplaceUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          field: ['issue', 'assignee', 'title'],
        }),
      })
    );
  });

  it('resets the widget builder state to dataset defaults when display type is changed from text widget', async () => {
    render(
      <WidgetBuilderProvider>
        <TypeSelector />
      </WidgetBuilderProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/dashboard/1/',
            query: {displayType: 'text'},
          },
        },
        organization: OrganizationFixture(),
      }
    );

    await userEvent.click(await screen.findByText('Text (Markdown)'));
    await userEvent.click(await screen.findByText('Table'));

    expect(mockReplaceUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          displayType: 'table',
        }),
      })
    );
    expect(mockReplaceUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: WidgetType.ERRORS,
        }),
      })
    );
    expect(mockReplaceUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          field: ['count_unique(user)'],
        }),
      })
    );
  });
});
