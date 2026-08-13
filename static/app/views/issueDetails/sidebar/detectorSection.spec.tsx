import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IssueCategory, IssueType} from 'sentry/types/group';
import {IssueDetailsContext} from 'sentry/views/issueDetails/context';
import {
  DetectorSection,
  getDetectorDetails,
} from 'sentry/views/issueDetails/sidebar/detectorSection';

describe('DetectorSection', () => {
  const detectorId = '123';
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const issueDetailsContext = {
    sectionData: {},
    detectorDetails: {},
    isSidebarOpen: true,
    navScrollMargin: 0,
    eventCount: 0,
    dispatch: jest.fn(),
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/${detectorId}/`,
      body: MetricDetectorFixture({
        id: detectorId,
      }),
    });
  });

  it('does not display detector details when no detector is found', () => {
    const group = GroupFixture({detectorId: null});
    const detectorDetails = getDetectorDetails({group, organization});

    const {container} = render(
      <IssueDetailsContext value={{...issueDetailsContext, detectorDetails}}>
        <DetectorSection group={group} project={project} />
      </IssueDetailsContext>,
      {organization}
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('displays the detector details for a metric issue', () => {
    const group = GroupFixture({
      detectorId,
      issueCategory: IssueCategory.METRIC,
      issueType: IssueType.METRIC_ISSUE,
    });
    const detectorDetails = getDetectorDetails({group, organization});

    render(
      <IssueDetailsContext value={{...issueDetailsContext, detectorDetails}}>
        <DetectorSection group={group} project={project} />
      </IssueDetailsContext>,
      {organization}
    );

    expect(screen.getByText('Metric Monitor')).toBeInTheDocument();
    const link = screen.getByRole('button', {name: 'View monitor details'});
    expect(link).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/monitors/${detectorId}/`
    );
    expect(
      screen.getByText(
        'This issue was created by a metric monitor. View the monitor details to learn more.'
      )
    ).toBeInTheDocument();
  });

  it('displays the detector details for a cron monitor', () => {
    const group = GroupFixture({
      detectorId,
      issueCategory: IssueCategory.CRON,
      issueType: IssueType.MONITOR_CHECK_IN_FAILURE,
    });
    const detectorDetails = getDetectorDetails({group, organization});

    render(
      <IssueDetailsContext value={{...issueDetailsContext, detectorDetails}}>
        <DetectorSection group={group} project={project} />
      </IssueDetailsContext>,
      {organization}
    );

    expect(screen.getByText('Cron Monitor')).toBeInTheDocument();
    const link = screen.getByRole('button', {name: 'View monitor details'});
    expect(link).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/monitors/${detectorId}/`
    );
    expect(
      screen.getByText(
        'This issue was created by a cron monitor. View the monitor details to learn more.'
      )
    ).toBeInTheDocument();
  });

  it('displays the detector details for a mobile build monitor', () => {
    const group = GroupFixture({
      detectorId,
      issueCategory: IssueCategory.PREPROD,
      issueType: IssueType.PREPROD_SIZE_ANALYSIS,
    });
    const detectorDetails = getDetectorDetails({group, organization});

    render(
      <IssueDetailsContext value={{...issueDetailsContext, detectorDetails}}>
        <DetectorSection group={group} project={project} />
      </IssueDetailsContext>,
      {organization}
    );

    expect(screen.getByText('Mobile Build Monitor')).toBeInTheDocument();
    const link = screen.getByRole('button', {name: 'View monitor details'});
    expect(link).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/monitors/${detectorId}/`
    );
    expect(
      screen.getByText(
        'This issue was created by a mobile build monitor. View the monitor details to learn more.'
      )
    ).toBeInTheDocument();
  });

  it('displays the detector details for an uptime monitor', () => {
    const group = GroupFixture({
      detectorId,
      issueCategory: IssueCategory.UPTIME,
      issueType: IssueType.UPTIME_DOMAIN_FAILURE,
    });

    const detectorDetails = getDetectorDetails({group, organization});

    render(
      <IssueDetailsContext value={{...issueDetailsContext, detectorDetails}}>
        <DetectorSection group={group} project={project} />
      </IssueDetailsContext>,
      {organization}
    );

    expect(screen.getByText('Uptime Monitor')).toBeInTheDocument();
    const link = screen.getByRole('button', {name: 'View monitor details'});
    expect(link).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/monitors/${detectorId}/`
    );
    expect(
      screen.getByText('This issue was created by an uptime monitor.')
    ).toBeInTheDocument();
  });
});
