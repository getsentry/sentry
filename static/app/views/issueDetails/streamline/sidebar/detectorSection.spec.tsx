import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IssueCategory, IssueType} from 'sentry/types/group';
import {IssueDetailsContext} from 'sentry/views/issueDetails/streamline/context';
import {
  DetectorSection,
  getDetectorDetails,
} from 'sentry/views/issueDetails/streamline/sidebar/detectorSection';

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

  it('does not display detector details when no detector is found', () => {
    const event = EventFixture();
    const group = GroupFixture();
    const detectorDetails = getDetectorDetails({event, organization, project});

    const {container} = render(
      <IssueDetailsContext value={{...issueDetailsContext, detectorDetails}}>
        <DetectorSection group={group} project={project} />
      </IssueDetailsContext>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('displays the detector details for a metric issue', () => {
    const event = EventFixture({
      occurrence: {
        evidenceData: {
          detectorId,
        },
        type: 8001,
      },
    });
    const group = GroupFixture({
      issueCategory: IssueCategory.METRIC,
      issueType: IssueType.METRIC_ISSUE,
    });
    const detectorDetails = getDetectorDetails({event, organization, project});

    render(
      <IssueDetailsContext value={{...issueDetailsContext, detectorDetails}}>
        <DetectorSection group={group} project={project} />
      </IssueDetailsContext>
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
    const event = EventFixture({
      tags: [
        {
          key: 'monitor.slug',
          value: detectorId,
        },
      ],
    });
    const group = GroupFixture({
      issueCategory: IssueCategory.CRON,
      issueType: IssueType.MONITOR_CHECK_IN_FAILURE,
    });
    const detectorDetails = getDetectorDetails({event, organization, project});

    render(
      <IssueDetailsContext value={{...issueDetailsContext, detectorDetails}}>
        <DetectorSection group={group} project={project} />
      </IssueDetailsContext>
    );

    expect(screen.getByText('Cron Monitor')).toBeInTheDocument();
    const link = screen.getByRole('button', {name: 'View monitor details'});
    expect(link).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/alerts/rules/crons/${project.slug}/${detectorId}/details/`
    );
    expect(
      screen.getByText(
        'This issue was created by a cron monitor. View the monitor details to learn more.'
      )
    ).toBeInTheDocument();
  });

  it('displays the detector details for an uptime monitor', () => {
    const event = EventFixture({
      occurrence: {
        evidenceData: {detectorId},
      },
    });
    const group = GroupFixture({
      issueCategory: IssueCategory.UPTIME,
      issueType: IssueType.UPTIME_DOMAIN_FAILURE,
    });

    const detectorDetails = getDetectorDetails({event, organization, project});

    render(
      <IssueDetailsContext value={{...issueDetailsContext, detectorDetails}}>
        <DetectorSection group={group} project={project} />
      </IssueDetailsContext>
    );

    expect(screen.getByText('Uptime Monitor')).toBeInTheDocument();
    const link = screen.getByRole('button', {name: 'View alert details'});
    expect(link).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/alerts/rules/uptime/${project.slug}/${detectorId}/details/`
    );
    expect(
      screen.getByText('This issue was created by an uptime monitoring alert rule.')
    ).toBeInTheDocument();
  });
});
