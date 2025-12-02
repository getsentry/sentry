import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useNavigate} from 'sentry/utils/useNavigate';
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
});
