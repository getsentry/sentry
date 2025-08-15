import {render, screen} from 'sentry-test/reactTestingLibrary';

import ToolbarHeader from 'sentry/components/toolbarHeader';

describe('ToolbarHeader', () => {
  it('renders', () => {
    render(
      <ToolbarHeader>
        <div>Toolbar Header</div>
      </ToolbarHeader>
    );
    expect(screen.getByText('Toolbar Header')).toBeInTheDocument();
  });
});
