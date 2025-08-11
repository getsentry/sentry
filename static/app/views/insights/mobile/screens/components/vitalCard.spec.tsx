import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import VitalCard from 'sentry/views/insights/mobile/screens/components/vitalCard';

describe('VitalCard', function () {
  const mockProps = {
    description: 'This is a test description',
    formattedValue: '123ms',
    status: 'good',
    statusLabel: 'Good',
    title: 'Test Vital',
  };

  it('renders correctly', function () {
    render(<VitalCard {...mockProps} />);
    expect(screen.getByText(mockProps.title)).toBeInTheDocument();
    expect(screen.getByText(mockProps.formattedValue)).toBeInTheDocument();
    expect(screen.getByText(mockProps.statusLabel)).toBeInTheDocument();
  });

  it('displays the description tooltip on hover', async function () {
    render(<VitalCard {...mockProps} />);
    await userEvent.hover(await screen.findByTestId('more-information'));
    expect(await screen.findByText(mockProps.description)).toBeInTheDocument();
  });

  it('displays default values when props are undefined', async function () {
    const defaultProps = {
      description: '',
      formattedValue: undefined,
      status: undefined,
      statusLabel: undefined,
      title: 'Default Vital',
    };

    render(<VitalCard {...defaultProps} />);

    expect(await screen.findByText(defaultProps.title)).toBeInTheDocument();
    expect(await screen.findAllByText('-')).toHaveLength(2);
  });
});
