import {render, screen} from 'sentry-test/reactTestingLibrary';

import ToolbarHeader from 'sentry/components/toolbarHeader';

describe('ToolbarHeader', function () {
  it('renders', function () {
    render(
      <ToolbarHeader>
        <div>Toolbar Header</div>
      </ToolbarHeader>
    );
    expect(screen.getByText('Toolbar Header')).toBeInTheDocument();
  });
});
