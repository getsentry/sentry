import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SamplingModeSwitch} from 'sentry/views/settings/dynamicSampling/samplingModeSwitch';
import {openSamplingModeSwitchModal} from 'sentry/views/settings/dynamicSampling/samplingModeSwitchModal';

jest.mock('sentry/views/settings/dynamicSampling/samplingModeSwitchModal');

describe('SamplingModeSwitch', () => {
  const organization = OrganizationFixture({
    access: ['org:write'],
    samplingMode: 'organization',
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('cannot enter advanced mode from organization mode', async () => {
    render(<SamplingModeSwitch />, {
      organization,
    });

    expect(screen.getByText('Advanced Mode')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('checkbox')).toBeDisabled();

    await userEvent.hover(screen.getByRole('checkbox'));
    expect(
      await screen.findByText(
        'Advanced Mode is no longer available. Sample rates are configured for the whole organization.'
      )
    ).toBeInTheDocument();
    expect(openSamplingModeSwitchModal).not.toHaveBeenCalled();
  });

  it('renders correctly in project mode', () => {
    render(<SamplingModeSwitch />, {
      organization: {...organization, samplingMode: 'project'},
    });

    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByRole('checkbox')).toBeEnabled();
  });

  it('opens the modal to leave advanced mode when the switch is clicked', async () => {
    render(<SamplingModeSwitch initialTargetRate={0.3} />, {
      organization: {...organization, samplingMode: 'project'},
    });

    await userEvent.click(screen.getByRole('checkbox'));

    expect(openSamplingModeSwitchModal).toHaveBeenCalledWith({
      samplingMode: 'organization',
      initialTargetRate: 0.3,
    });
  });

  it('disables switch when user lacks permission', async () => {
    const orgWithoutAccess = OrganizationFixture({
      access: [], // No project:write access
      samplingMode: 'project',
    });

    render(<SamplingModeSwitch />, {
      organization: orgWithoutAccess,
    });

    expect(screen.getByRole('checkbox')).toBeDisabled();

    await userEvent.hover(screen.getByRole('checkbox'));
    expect(
      await screen.findByText('You do not have permission to change this setting.')
    ).toBeInTheDocument();
  });
});
