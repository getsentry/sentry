import {IssueStreamDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';

import type {AutomationFormData} from 'sentry/views/automations/components/automationFormData';
import {resolveDetectorIdsForProjects} from 'sentry/views/automations/utils/resolveDetectorIdsForProjects';

describe('resolveDetectorIdsForProjects', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('resolves the all-projects detector', async () => {
    const organization = OrganizationFixture();
    const allProjectsDetector = IssueStreamDetectorFixture({
      id: '10',
      projectId: null,
      config: {organization_id: Number(organization.id)},
    });
    const formData: AutomationFormData = {
      allProjects: true,
      detectorIds: [],
      enabled: true,
      environment: null,
      frequency: 0,
      name: 'All projects alert',
      projectIds: [],
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/`,
      body: [IssueStreamDetectorFixture({id: '11', projectId: '1'}), allProjectsDetector],
    });

    const result = await resolveDetectorIdsForProjects({
      formData,
      organization,
      queryClient: makeTestQueryClient(),
    });

    expect(result?.detectorIds).toEqual([allProjectsDetector.id]);
  });
});
