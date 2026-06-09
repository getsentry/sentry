import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';

const INTERNAL_ERROR_MESSAGE = 'Cannot read properties of undefined (reading "secret")';

function ExplodingVisualization(): React.ReactNode {
  throw new Error(INTERNAL_ERROR_MESSAGE);
}

describe('Widget', () => {
  it('renders the visualization when it does not error', () => {
    render(<Widget Visualization={<div>Chart contents</div>} />);

    expect(screen.getByText('Chart contents')).toBeInTheDocument();
  });

  it('hides the internal error and shows a friendly message when the visualization throws', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<Widget Visualization={<ExplodingVisualization />} />);

    expect(
      screen.getByText('Something went wrong displaying this widget.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText(new RegExp(INTERNAL_ERROR_MESSAGE))
    ).not.toBeInTheDocument();

    errorSpy.mockRestore();
  });

  it('hides the internal error in the footer when it throws', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<Widget Footer={<ExplodingVisualization />} />);

    expect(
      screen.getByText('Something went wrong displaying this widget.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText(new RegExp(INTERNAL_ERROR_MESSAGE))
    ).not.toBeInTheDocument();

    errorSpy.mockRestore();
  });
});
