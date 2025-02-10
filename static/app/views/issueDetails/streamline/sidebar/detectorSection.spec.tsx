import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IssueType} from 'sentry/types/group';
import {IssueCategory} from 'sentry/types/group';
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
      <IssueDetailsContext.Provider value={{...issueDetailsContext, detectorDetails}}>
        <DetectorSection group={group} project={project} />
      </IssueDetailsContext.Provider>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('displays the detector details for a metric issue', () => {
    const event = EventFixture({
      contexts: {
        metric_alert: {
          alert_rule_id: '123',
        },
      },
    });
    const group = GroupFixture({
      issueCategory: IssueCategory.METRIC_ALERT,
      issueType: IssueType.METRIC_ISSUE_POC,
    });
    const detectorDetails = getDetectorDetails({event, organization, project});

    render(
      <IssueDetailsContext.Provider value={{...issueDetailsContext, detectorDetails}}>
        <DetectorSection group={group} project={project} />
      </IssueDetailsContext.Provider>
    );

    expect(screen.getByText('Metric Alert Detector')).toBeInTheDocument();
    const link = screen.getByRole('button', {name: 'View detector details'});
    expect(link).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/alerts/rules/details/${detectorId}/`
    );
    expect(
      screen.getByText(
        'This issue was created by a metric alert detector. View the detector details to learn more.'
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
      <IssueDetailsContext.Provider value={{...issueDetailsContext, detectorDetails}}>
        <DetectorSection group={group} project={project} />
      </IssueDetailsContext.Provider>
    );

    expect(screen.getByText('Cron Monitor')).toBeInTheDocument();
    const link = screen.getByRole('button', {name: 'View monitor details'});
    expect(link).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/alerts/rules/crons/${project.slug}/${detectorId}/details/`
    );
    expect(
      screen.getByText(
        'This issue was created by a cron monitor. View the monitor details to learn more.'
      )
    ).toBeInTheDocument();
  });

  it('displays the detector details for an uptime monitor', () => {
    const event = EventFixture({
      tags: [
        {
          key: 'uptime_rule',
          value: detectorId,
        },
      ],
    });
    const group = GroupFixture({
      issueCategory: IssueCategory.UPTIME,
      issueType: IssueType.UPTIME_DOMAIN_FAILURE,
    });

    const detectorDetails = getDetectorDetails({event, organization, project});

    render(
      <IssueDetailsContext.Provider value={{...issueDetailsContext, detectorDetails}}>
        <DetectorSection group={group} project={project} />
      </IssueDetailsContext.Provider>
    );

    expect(screen.getByText('Uptime Monitor')).toBeInTheDocument();
    const link = screen.getByRole('button', {name: 'View alert details'});
    expect(link).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/alerts/rules/uptime/${project.slug}/${detectorId}/details/`
    );
    expect(
      screen.getByText(
        'This issue was created by an uptime monitoring alert rule after detecting 3 consecutive failed checks.'
      )
    ).toBeInTheDocument();
  });
});
