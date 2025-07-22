import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import DataSecrecy from 'sentry/views/settings/components/dataSecrecy';

jest.mock('sentry/actionCreators/indicator');

describe('DataSecrecy', function () {
  const {organization} = initializeOrg({
    organization: {features: ['data-secrecy']},
  });

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders with access disabled', function () {
    const orgWithoutAccess = {
      ...organization,
      allowSuperuserAccess: false,
    };

    render(<DataSecrecy />, {organization: orgWithoutAccess});

    expect(screen.getByText('Support Access')).toBeInTheDocument();
    expect(
      screen.getByText('Sentry employees do not have access to your organization')
    ).toBeInTheDocument();

    const checkbox = screen.getByRole('checkbox', {
      name: /Sentry employees will not have access to your data unless granted permission/,
    });
    expect(checkbox).not.toBeChecked();
  });

  it('renders with access enabled', function () {
    const orgWithAccess = {
      ...organization,
      allowSuperuserAccess: true,
    };

    render(<DataSecrecy />, {organization: orgWithAccess});

    expect(screen.getByText('Support Access')).toBeInTheDocument();
    expect(
      screen.getByText('Sentry employees have access to your organization')
    ).toBeInTheDocument();

    const checkbox = screen.getByRole('checkbox', {
      name: /Sentry employees will not have access to your data unless granted permission/,
    });
    expect(checkbox).toBeChecked();
  });

  it('can toggle access on', async function () {
    const mockUpdate = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
    });

    const orgWithoutAccess = {
      ...organization,
      allowSuperuserAccess: false,
    };

    render(<DataSecrecy />, {organization: orgWithoutAccess});

    const checkbox = screen.getByRole('checkbox', {
      name: /Sentry employees will not have access to your data unless granted permission/,
    });

    await userEvent.click(checkbox);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: {allowSuperuserAccess: true},
        })
      );
    });
  });

  it('can toggle access off', async function () {
    const mockUpdate = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
    });

    const orgWithAccess = {
      ...organization,
      allowSuperuserAccess: true,
    };

    render(<DataSecrecy />, {organization: orgWithAccess});

    const checkbox = screen.getByRole('checkbox', {
      name: /Sentry employees will not have access to your data unless granted permission/,
    });

    await userEvent.click(checkbox);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: {allowSuperuserAccess: false},
        })
      );
    });
  });

  it('disables checkbox when user lacks org:write permission', function () {
    const orgWithoutWriteAccess = {
      ...organization,
      allowSuperuserAccess: false,
      access: [], // Remove 'org:write' permission
    };

    render(<DataSecrecy />, {organization: orgWithoutWriteAccess});

    const checkbox = screen.getByRole('checkbox', {
      name: /Sentry employees will not have access to your data unless granted permission/,
    });
    expect(checkbox).toBeDisabled();
  });
});
