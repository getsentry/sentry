import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SamplingModeSwitch} from 'sentry/views/settings/dynamicSampling/samplingModeSwitch';
import {openSamplingModeSwitchModal} from 'sentry/views/settings/dynamicSampling/samplingModeSwitchModal';

jest.mock('sentry/views/settings/dynamicSampling/samplingModeSwitchModal');

describe('SamplingModeSwitch', function () {
  const organization = OrganizationFixture({
    access: ['org:write'],
    samplingMode: 'organization',
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders correctly in organization mode', function () {
    render(<SamplingModeSwitch />, {
      organization,
    });

    expect(screen.getByRole('checkbox')).toBeEnabled();
    expect(screen.getByText('Advanced Mode')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('renders correctly in project mode', function () {
    render(<SamplingModeSwitch />, {
      organization: {...organization, samplingMode: 'project'},
    });

    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('opens modal when switch is clicked', async function () {
    render(<SamplingModeSwitch initialTargetRate={0.3} />, {
      organization,
    });

    await userEvent.click(screen.getByRole('checkbox'));

    expect(openSamplingModeSwitchModal).toHaveBeenCalledWith({
      samplingMode: 'project',
      initialTargetRate: 0.3,
    });
  });

  it('disables switch when user lacks permission', function () {
    const orgWithoutAccess = OrganizationFixture({
      access: [], // No project:write access
      samplingMode: 'organization',
    });

    render(<SamplingModeSwitch />, {
      organization: orgWithoutAccess,
    });

    expect(screen.getByRole('checkbox')).toBeDisabled();
  });
});
