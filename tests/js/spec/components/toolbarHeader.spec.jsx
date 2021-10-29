import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import ToolbarHeader from 'app/components/toolbarHeader';

describe('ToolbarHeader', function () {
  beforeEach(function () {});

  afterEach(function () {});

  it('renders', function () {
    const {container} = mountWithTheme(
      <ToolbarHeader>
        <div>Toolbar Header</div>
      </ToolbarHeader>
    );
    expect(screen.getByText('Toolbar Header')).toBeInTheDocument();
    expect(container).toSnapshot();
  });
});
