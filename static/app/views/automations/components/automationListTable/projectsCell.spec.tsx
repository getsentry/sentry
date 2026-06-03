import {AutomationFixture} from 'sentry-fixture/automations';
import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {DetectorDataContextProvider} from 'sentry/views/automations/components/automationListTable/detectorDataContext';
import {ProjectsCell} from 'sentry/views/automations/components/automationListTable/projectsCell';

describe('ProjectsCell', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders empty cell when automation has no detectors', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [],
    });

    const automation = AutomationFixture({detectorIds: []});

    render(
      <DetectorDataContextProvider detectorIds={[]}>
        <ProjectsCell automation={automation} />
      </DetectorDataContextProvider>
    );

    expect(await screen.findByText('—')).toBeInTheDocument();
  });

  it('uses batch context to resolve project slugs in a single request', async () => {
    const project1 = ProjectFixture({id: '1', slug: 'project-alpha'});
    const project2 = ProjectFixture({id: '2', slug: 'project-beta'});
    ProjectsStore.loadInitialData([project1, project2]);

    const batchDetectorsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [
        MetricDetectorFixture({id: 'det-1', projectId: '1'}),
        MetricDetectorFixture({id: 'det-2', projectId: '2'}),
        MetricDetectorFixture({id: 'det-3', projectId: '1'}),
      ],
    });

    const automation = AutomationFixture({
      detectorIds: ['det-1', 'det-3'],
    });

    render(
      <DetectorDataContextProvider detectorIds={['det-1', 'det-2', 'det-3']}>
        <ProjectsCell automation={automation} />
      </DetectorDataContextProvider>
    );

    const link = await screen.findByRole('link', {name: 'View Project Details'});
    expect(link).toHaveAttribute('aria-description', 'project-alpha');

    await waitFor(() => {
      expect(batchDetectorsRequest).toHaveBeenCalledTimes(1);
    });
    expect(batchDetectorsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/detectors/',
      expect.objectContaining({
        query: expect.objectContaining({
          id: ['det-1', 'det-2', 'det-3'],
        }),
      })
    );
  });
});
