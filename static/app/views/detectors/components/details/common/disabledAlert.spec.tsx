import {UptimeDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';

import {DisabledAlert} from './disabledAlert';

describe('DisabledAlert', () => {
  const organization = OrganizationFixture({
    access: ['org:write', 'alerts:write'],
    alertsMemberWrite: true,
  });
  const project = ProjectFixture({access: ['alerts:write']});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    act(() => ProjectsStore.loadInitialData([project]));
  });

  it('does not render when detector is enabled', () => {
    const detector = UptimeDetectorFixture({enabled: true, projectId: project.id});

    const {container} = render(
      <DisabledAlert detector={detector} message="Test disabled message" />,
      {organization}
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders alert with message and enable button when detector is disabled', () => {
    const detector = UptimeDetectorFixture({enabled: false, projectId: project.id});

    render(<DisabledAlert detector={detector} message="Test disabled message" />, {
      organization,
    });

    expect(screen.getByText('Test disabled message')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Enable'})).toBeInTheDocument();
  });

  it('enables detector when enable button is clicked', async () => {
    const detector = UptimeDetectorFixture({
      id: '123',
      enabled: false,
      projectId: project.id,
    });

    const updateRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/123/',
      method: 'PUT',
      body: {...detector, enabled: true},
    });

    render(<DisabledAlert detector={detector} message="Test message" />, {
      organization,
    });

    const enableButton = await screen.findByRole('button', {name: 'Enable'});
    expect(enableButton).toBeEnabled();

    await userEvent.click(enableButton);

    await waitFor(() => {
      expect(updateRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'PUT',
          data: {detectorId: '123', enabled: true},
        })
      );
    });
  });
});
