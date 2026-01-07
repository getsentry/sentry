import {render, screen} from 'sentry-test/reactTestingLibrary';

import {isDemoModeActive} from 'sentry/utils/demoMode';

import DisableInDemoMode from './demoModeDisabled'; // Adjust the import path as necessary

jest.mock('sentry/utils/demoMode', () => ({
  isDemoModeActive: jest.fn(),
}));

jest.mock('sentry/locale', () => ({
  t: jest.fn(key => key), // Mock translation function
  td: jest.fn(key => key), // Mock translation description function
}));

describe('DisableInDemoMode', () => {
  it('renders children when demo mode is disabled', () => {
    (isDemoModeActive as jest.Mock).mockReturnValue(false);

    render(
      <DisableInDemoMode>
        <span>Test Child</span>
      </DisableInDemoMode>
    );

    expect(screen.getByText('Test Child')).toBeInTheDocument();
    expect(screen.queryByTestId('demo-mode-disabled-wrapper')).not.toBeInTheDocument();
  });

  it('renders a tooltip when demo mode is enabled', () => {
    (isDemoModeActive as jest.Mock).mockReturnValue(true);

    render(
      <DisableInDemoMode>
        <span>Test Child</span>
      </DisableInDemoMode>
    );

    const childDiv = screen.getByText('Test Child');
    const innerWrapper = childDiv.parentElement;
    const outerWrapper = innerWrapper?.parentElement;

    expect(childDiv).toBeInTheDocument();
    expect(innerWrapper).toHaveStyle('pointer-events: none;');
    expect(outerWrapper).toHaveStyle('opacity: 0.6;');
    expect(outerWrapper).toHaveStyle('cursor: not-allowed;');
  });
});
