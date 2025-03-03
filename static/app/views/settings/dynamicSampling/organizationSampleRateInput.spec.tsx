import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {OrganizationSampleRateInput} from './organizationSampleRateInput';

describe('OrganizationSampleRateInput', () => {
  const organization = OrganizationFixture({
    access: ['org:write'],
  });

  const defaultProps = {
    value: '10',
    onChange: jest.fn(),
    label: 'Sample Rate',
    help: 'Help text',
    previousValue: '20',
    showPreviousValue: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with basic props', () => {
    render(<OrganizationSampleRateInput {...defaultProps} />, {
      organization,
    });

    expect(screen.getByRole('spinbutton')).toHaveValue(10);
    expect(screen.getByText('Sample Rate')).toBeInTheDocument();
    expect(screen.getByText('Help text')).toBeInTheDocument();
  });

  it('shows previous value when showPreviousValue is true', () => {
    render(<OrganizationSampleRateInput {...defaultProps} showPreviousValue />, {
      organization,
    });

    expect(screen.getByText('previous: 20%')).toBeInTheDocument();
  });

  it('shows "All spans are stored" message when value is 100', () => {
    render(<OrganizationSampleRateInput {...defaultProps} value="100" />, {
      organization,
    });

    expect(screen.getByText('All spans are stored')).toBeInTheDocument();
  });

  it('shows error message when error prop is provided', () => {
    render(<OrganizationSampleRateInput {...defaultProps} error="Invalid value" />, {
      organization,
    });

    expect(screen.getByText('Invalid value')).toBeInTheDocument();
  });

  describe('Access Control', () => {
    it('disables input when user does not have access', () => {
      const orgWithoutAccess = OrganizationFixture({
        access: [], // No org:write access
      });

      render(<OrganizationSampleRateInput {...defaultProps} />, {
        organization: orgWithoutAccess,
      });

      expect(screen.getByRole('spinbutton')).toBeDisabled();
    });

    it('enables input when user has access', () => {
      render(<OrganizationSampleRateInput {...defaultProps} />, {
        organization,
      });

      expect(screen.getByRole('spinbutton')).toBeEnabled();
    });
  });

  describe('Bulk Edit Mode', () => {
    it('shows bulk edit button when enabled and user has access', () => {
      const {rerender} = render(
        <OrganizationSampleRateInput
          {...defaultProps}
          isBulkEditEnabled
          isBulkEditActive={false}
          onBulkEditChange={jest.fn()}
        />,
        {organization}
      );

      expect(
        screen.getByRole('button', {name: 'Proportionally scale project rates'})
      ).toBeInTheDocument();

      // In active state, the button should not be shown
      rerender(
        <OrganizationSampleRateInput
          {...defaultProps}
          isBulkEditEnabled
          isBulkEditActive
          onBulkEditChange={jest.fn()}
        />
      );

      expect(
        screen.queryByRole('button', {name: 'Proportionally scale project rates'})
      ).not.toBeInTheDocument();
    });

    it('hides bulk edit button when user does not have access', () => {
      const orgWithoutAccess = OrganizationFixture({
        access: [], // No org:write access
      });

      render(
        <OrganizationSampleRateInput
          {...defaultProps}
          isBulkEditEnabled
          isBulkEditActive={false}
          onBulkEditChange={jest.fn()}
        />,
        {organization: orgWithoutAccess}
      );

      expect(
        screen.queryByRole('button', {name: 'Proportionally scale project rates'})
      ).not.toBeInTheDocument();
    });

    it('autofocuses input after bulk edit becomes active', async () => {
      const onBulkEditChange = jest.fn();
      const {rerender} = render(
        <OrganizationSampleRateInput
          {...defaultProps}
          isBulkEditEnabled
          isBulkEditActive={false}
          onBulkEditChange={onBulkEditChange}
        />,
        {organization}
      );

      const input = screen.getByRole('spinbutton');
      expect(input).not.toHaveFocus();

      await userEvent.click(
        screen.getByRole('button', {name: 'Proportionally scale project rates'})
      );
      expect(onBulkEditChange).toHaveBeenCalledWith(true);

      // Simulate the parent component updating the active state
      rerender(
        <OrganizationSampleRateInput
          {...defaultProps}
          isBulkEditEnabled
          isBulkEditActive
          onBulkEditChange={onBulkEditChange}
        />
      );

      expect(input).toHaveFocus();
    });
  });
});
