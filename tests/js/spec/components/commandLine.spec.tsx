import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import CommandLine from 'sentry/components/commandLine';

describe('CommandLine', () => {
  it('renders', () => {
    const children = 'sentry devserver --workers';
    mountWithTheme(<CommandLine>{children}</CommandLine>);
    expect(screen.getByText(children)).toBeInTheDocument();
  });
});
