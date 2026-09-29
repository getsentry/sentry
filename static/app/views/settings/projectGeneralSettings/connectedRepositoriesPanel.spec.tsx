import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ConnectedRepositoriesPanel} from 'sentry/views/settings/projectGeneralSettings/connectedRepositoriesPanel';

describe('ConnectedRepositoriesPanel', () => {
  it('renders panel with empty state', () => {
    render(<ConnectedRepositoriesPanel />);

    expect(screen.getByText('Connected Repositories')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Connect repository'})).toBeInTheDocument();
    expect(screen.getByText('No repositories connected')).toBeInTheDocument();
  });
});
