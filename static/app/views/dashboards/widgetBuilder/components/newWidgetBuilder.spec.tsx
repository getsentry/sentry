import {render, screen} from 'sentry-test/reactTestingLibrary';

import DevWidgetBuilder from 'sentry/views/dashboards/widgetBuilder/components/newWidgetBuilder';

describe('NewWidgetBuiler', function () {
  const onCloseMock = jest.fn();
  it('renders', async function () {
    render(<DevWidgetBuilder isOpen onClose={onCloseMock} />);

    expect(await screen.findByText('Create Custom Widget')).toBeInTheDocument();

    expect(await screen.findByLabelText('Close Widget Builder')).toBeInTheDocument();
  });
});
