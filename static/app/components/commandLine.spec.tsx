import {render, screen} from 'sentry-test/reactTestingLibrary';

import {CommandLine} from './commandLine';

describe('CommandLine', () => {
  it('renders', () => {
    const children = 'sentry devserver --workers';
    render(<CommandLine>{children}</CommandLine>);
    expect(screen.getByText(children)).toBeInTheDocument();
  });
});
