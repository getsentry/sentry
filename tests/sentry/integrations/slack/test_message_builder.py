from __future__ import annotations

from datetime import datetime
from typing import Any, Mapping
from unittest.mock import patch

from django.urls import reverse

from sentry.eventstore.models import Event
from sentry.incidents.logic import CRITICAL_TRIGGER_LABEL
from sentry.incidents.models import IncidentStatus
from sentry.integrations.slack.message_builder import LEVEL_TO_COLOR
from sentry.integrations.slack.message_builder.incidents import SlackIncidentsMessageBuilder
from sentry.integrations.slack.message_builder.issues import (
    SlackIssuesMessageBuilder,
    get_option_groups,
)
from sentry.integrations.slack.message_builder.metric_alerts import SlackMetricAlertMessageBuilder
from sentry.issues.grouptype import PerformanceNPlusOneGroupType, ProfileFileIOGroupType
from sentry.models import Group, Team, User
from sentry.testutils import TestCase
from sentry.testutils.cases import PerformanceIssueTestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.dates import to_timestamp
from sentry.utils.http import absolute_uri
from tests.sentry.issues.test_utils import OccurrenceTestMixin


def build_test_message(
    teams: set[Team],
    users: set[User],
    timestamp: datetime,
    group: Group,
    event: Event | None = None,
    link_to_event: bool = False,
) -> Mapping[str, Any]:
    project = group.project

    title = group.title
    title_link = f"http://testserver/organizations/{project.organization.slug}/issues/{group.id}"
    if event:
        title = event.title
        if link_to_event:
            title_link += f"/events/{event.event_id}"
    title_link += "/?referrer=slack"

    return {
        "text": "",
        "color": "#E03E2F",  # red for error level
        "actions": [
            {"name": "status", "text": "Resolve", "type": "button", "value": "resolved"},
            {"name": "status", "text": "Ignore", "type": "button", "value": "ignored"},
            {
                "option_groups": [
                    {
                        "text": "Teams",
                        "options": [
                            {"text": f"#{team.slug}", "value": f"team:{team.id}"} for team in teams
                        ],
                    },
                    {
                        "text": "People",
                        "options": [
                            {
                                "text": user.email,
                                "value": f"user:{user.id}",
                            }
                            for user in users
                        ],
                    },
                ],
                "text": "Select Assignee...",
                "selected_options": [],
                "type": "select",
                "name": "assign",
            },
        ],
        "mrkdwn_in": ["text"],
        "title": title,
        "fields": [],
        "footer": f"{project.slug.upper()}-1",
        "ts": to_timestamp(timestamp),
        "title_link": title_link,
        "callback_id": '{"issue":' + str(group.id) + "}",
        "fallback": f"[{project.slug}] {title}",
        "footer_icon": "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png",
    }


@region_silo_test(stable=True)
class BuildGroupAttachmentTest(TestCase, PerformanceIssueTestCase, OccurrenceTestMixin):
    def test_build_group_attachment(self):
        group = self.create_group(project=self.project)

        assert SlackIssuesMessageBuilder(group).build() == build_test_message(
            teams={self.team},
            users={self.user},
            timestamp=group.last_seen,
            group=group,
        )

        event = self.store_event(data={}, project_id=self.project.id)

        assert SlackIssuesMessageBuilder(group, event).build() == build_test_message(
            teams={self.team},
            users={self.user},
            timestamp=event.datetime,
            group=group,
            event=event,
        )

        assert SlackIssuesMessageBuilder(
            group, event, link_to_event=True
        ).build() == build_test_message(
            teams={self.team},
            users={self.user},
            timestamp=event.datetime,
            group=group,
            event=event,
            link_to_event=True,
        )

    @patch(
        "sentry.integrations.slack.message_builder.issues.get_option_groups",
        wraps=get_option_groups,
    )
    def test_build_group_attachment_prune_duplicate_assignees(self, mock_get_option_groups):
        user2 = self.create_user()
        team2 = self.create_team(organization=self.organization, members=[self.user])
        self.create_member(user=user2, organization=self.organization, teams=[team2])
        project2 = self.create_project(organization=self.organization, teams=[self.team, team2])
        group = self.create_group(project=project2)

        SlackIssuesMessageBuilder(group).build()
        assert mock_get_option_groups.called

        team_option_groups, member_option_groups = mock_get_option_groups(group)
        assert len(team_option_groups["options"]) == 2
        assert len(member_option_groups["options"]) == 2

    def test_build_group_attachment_issue_alert(self):
        issue_alert_group = self.create_group(project=self.project)
        assert (
            SlackIssuesMessageBuilder(issue_alert_group, issue_details=True).build()["actions"]
            == []
        )

    def test_build_group_attachment_color_no_event_error_fallback(self):
        group_with_no_events = self.create_group(project=self.project)
        assert SlackIssuesMessageBuilder(group_with_no_events).build()["color"] == "#E03E2F"

    def test_build_group_attachment_color_unexpected_level_error_fallback(self):
        unexpected_level_event = self.store_event(
            data={"level": "trace"}, project_id=self.project.id, assert_no_errors=False
        )
        assert SlackIssuesMessageBuilder(unexpected_level_event.group).build()["color"] == "#E03E2F"

    def test_build_group_attachment_color_warning(self):
        warning_event = self.store_event(data={"level": "warning"}, project_id=self.project.id)
        assert SlackIssuesMessageBuilder(warning_event.group).build()["color"] == "#FFC227"
        assert (
            SlackIssuesMessageBuilder(warning_event.group, warning_event).build()["color"]
            == "#FFC227"
        )

    def test_build_group_generic_issue_attachment(self):
        """Test that a generic issue type's Slack alert contains the expected values"""
        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )
        event = event.for_group(event.groups[0])
        occurrence = self.build_occurrence(level="info")
        occurrence.save()
        event.occurrence = occurrence

        event.group.type = ProfileFileIOGroupType.type_id

        attachments = SlackIssuesMessageBuilder(group=event.group, event=event).build()

        assert attachments["title"] == occurrence.issue_title
        assert attachments["text"] == occurrence.evidence_display[0].value
        assert attachments["fallback"] == f"[{self.project.slug}] {occurrence.issue_title}"
        assert attachments["color"] == "#2788CE"  # blue for info level

    def test_build_error_issue_fallback_text(self):
        event = self.store_event(data={}, project_id=self.project.id)
        attachments = SlackIssuesMessageBuilder(event.group, event).build()
        assert attachments["fallback"] == f"[{self.project.slug}] {event.group.title}"

    def test_build_performance_issue(self):
        event = self.create_performance_issue()
        with self.feature("organizations:performance-issues"):
            attachments = SlackIssuesMessageBuilder(event.group, event).build()
        assert attachments["title"] == "N+1 Query"
        assert (
            attachments["text"]
            == "db - SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21"
        )
        assert attachments["fallback"] == f"[{self.project.slug}] N+1 Query"
        assert attachments["color"] == "#2788CE"  # blue for info level

    def test_build_performance_issue_color_no_event_passed(self):
        """This test doesn't pass an event to the SlackIssuesMessageBuilder to mimic what
        could happen in that case (it is optional). It also creates a performance group that won't
        have a latest event attached to it to mimic a specific edge case.
        """
        perf_group = self.create_group(type=PerformanceNPlusOneGroupType.type_id)
        attachments = SlackIssuesMessageBuilder(perf_group).build()

        assert attachments["color"] == "#2788CE"  # blue for info level


class BuildIncidentAttachmentTest(TestCase):
    def test_simple(self):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=2)
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        title = f"Resolved: {alert_rule.name}"
        timestamp = "<!date^{:.0f}^Started {} at {} | Sentry Incident>".format(
            to_timestamp(incident.date_started), "{date_pretty}", "{time}"
        )
        link = (
            absolute_uri(
                reverse(
                    "sentry-metric-alert-details",
                    kwargs={
                        "organization_slug": alert_rule.organization.slug,
                        "alert_rule_id": alert_rule.id,
                    },
                )
            )
            + f"?alert={incident.identifier}&referrer=slack"
        )
        assert SlackIncidentsMessageBuilder(incident, IncidentStatus.CLOSED).build() == {
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"0 events in the last 10 minutes\n{timestamp}",
                    },
                }
            ],
            "color": LEVEL_TO_COLOR["_incident_resolved"],
            "text": f"<{link}|*{title}*>",
        }

    def test_metric_value(self):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=2)

        # This test will use the action/method and not the incident to build status
        title = f"Critical: {alert_rule.name}"
        metric_value = 5000
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        timestamp = "<!date^{:.0f}^Started {} at {} | Sentry Incident>".format(
            to_timestamp(incident.date_started), "{date_pretty}", "{time}"
        )
        link = (
            absolute_uri(
                reverse(
                    "sentry-metric-alert-details",
                    kwargs={
                        "organization_slug": alert_rule.organization.slug,
                        "alert_rule_id": alert_rule.id,
                    },
                )
            )
            + f"?alert={incident.identifier}&referrer=slack"
        )
        # This should fail because it pulls status from `action` instead of `incident`
        assert SlackIncidentsMessageBuilder(
            incident, IncidentStatus.CRITICAL, metric_value=metric_value
        ).build() == {
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"5000 events in the last 10 minutes\n{timestamp}",
                    },
                }
            ],
            "color": LEVEL_TO_COLOR["fatal"],
            "text": f"<{link}|*{title}*>",
        }

    def test_chart(self):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=2)
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        title = f"Resolved: {alert_rule.name}"
        timestamp = "<!date^{:.0f}^Started {} at {} | Sentry Incident>".format(
            to_timestamp(incident.date_started), "{date_pretty}", "{time}"
        )
        link = (
            absolute_uri(
                reverse(
                    "sentry-metric-alert-details",
                    kwargs={
                        "organization_slug": alert_rule.organization.slug,
                        "alert_rule_id": alert_rule.id,
                    },
                )
            )
            + f"?alert={incident.identifier}&referrer=slack"
        )
        assert SlackIncidentsMessageBuilder(
            incident, IncidentStatus.CLOSED, chart_url="chart-url"
        ).build() == {
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"0 events in the last 10 minutes\n{timestamp}",
                    },
                },
                {"alt_text": "Metric Alert Chart", "image_url": "chart-url", "type": "image"},
            ],
            "color": LEVEL_TO_COLOR["_incident_resolved"],
            "text": f"<{link}|*{title}*>",
        }


class BuildMetricAlertAttachmentTest(TestCase):
    def test_metric_alert_without_incidents(self):
        alert_rule = self.create_alert_rule()
        title = f"Resolved: {alert_rule.name}"
        link = absolute_uri(
            reverse(
                "sentry-metric-alert-details",
                kwargs={
                    "organization_slug": alert_rule.organization.slug,
                    "alert_rule_id": alert_rule.id,
                },
            )
        )
        assert SlackMetricAlertMessageBuilder(alert_rule).build() == {
            "color": LEVEL_TO_COLOR["_incident_resolved"],
            "blocks": [
                {
                    "text": {
                        "text": f"<{link}|*{title}*>  \n",
                        "type": "mrkdwn",
                    },
                    "type": "section",
                },
            ],
        }

    def test_metric_alert_with_selected_incident(self):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CLOSED.value)
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        title = f"Resolved: {alert_rule.name}"
        link = (
            absolute_uri(
                reverse(
                    "sentry-metric-alert-details",
                    kwargs={
                        "organization_slug": alert_rule.organization.slug,
                        "alert_rule_id": alert_rule.id,
                    },
                )
            )
            + f"?alert={incident.identifier}"
        )
        assert SlackMetricAlertMessageBuilder(alert_rule, incident).build() == {
            "color": LEVEL_TO_COLOR["_incident_resolved"],
            "blocks": [
                {
                    "text": {
                        "text": f"<{link}|*{title}*>  \n",
                        "type": "mrkdwn",
                    },
                    "type": "section",
                },
            ],
        }

    def test_metric_alert_with_active_incident(self):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CRITICAL.value)
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        title = f"Critical: {alert_rule.name}"
        link = absolute_uri(
            reverse(
                "sentry-metric-alert-details",
                kwargs={
                    "organization_slug": alert_rule.organization.slug,
                    "alert_rule_id": alert_rule.id,
                },
            )
        )
        assert SlackMetricAlertMessageBuilder(alert_rule).build() == {
            "color": LEVEL_TO_COLOR["fatal"],
            "blocks": [
                {
                    "text": {
                        "text": f"<{link}|*{title}*>  \n0 events in the last 10 minutes",
                        "type": "mrkdwn",
                    },
                    "type": "section",
                },
            ],
        }

    def test_metric_value(self):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CLOSED.value)

        # This test will use the action/method and not the incident to build status
        title = f"Critical: {alert_rule.name}"
        metric_value = 5000
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        link = absolute_uri(
            reverse(
                "sentry-metric-alert-details",
                kwargs={
                    "organization_slug": alert_rule.organization.slug,
                    "alert_rule_id": alert_rule.id,
                },
            )
        )
        assert SlackMetricAlertMessageBuilder(
            alert_rule, incident, IncidentStatus.CRITICAL, metric_value=metric_value
        ).build() == {
            "color": LEVEL_TO_COLOR["fatal"],
            "blocks": [
                {
                    "text": {
                        "text": f"<{link}?alert={incident.identifier}|*{title}*>  \n"
                        f"{metric_value} events in the last 10 minutes",
                        "type": "mrkdwn",
                    },
                    "type": "section",
                },
            ],
        }

    def test_metric_alert_chart(self):
        alert_rule = self.create_alert_rule()
        title = f"Resolved: {alert_rule.name}"
        link = absolute_uri(
            reverse(
                "sentry-metric-alert-details",
                kwargs={
                    "organization_slug": alert_rule.organization.slug,
                    "alert_rule_id": alert_rule.id,
                },
            )
        )
        assert SlackMetricAlertMessageBuilder(alert_rule, chart_url="chart_url").build() == {
            "color": LEVEL_TO_COLOR["_incident_resolved"],
            "blocks": [
                {
                    "text": {
                        "text": f"<{link}|*{title}*>  \n",
                        "type": "mrkdwn",
                    },
                    "type": "section",
                },
                {"alt_text": "Metric Alert Chart", "image_url": "chart_url", "type": "image"},
            ],
        }
