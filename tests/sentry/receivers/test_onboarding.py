from datetime import UTC, datetime
from unittest.mock import patch

import pytest
from django.utils import timezone

from sentry.api.invite_helper import ApiInviteHelper
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organizationonboardingtask import (
    OnboardingTask,
    OnboardingTaskStatus,
    OrganizationOnboardingTask,
)
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.organizations.services.organization import organization_service
from sentry.plugins.bases.issue import IssueTrackingPlugin
from sentry.signals import (
    alert_rule_created,
    event_processed,
    first_event_received,
    first_replay_received,
    first_transaction_received,
    integration_added,
    issue_tracker_used,
    member_invited,
    member_joined,
    plugin_enabled,
    project_created,
    transaction_processed,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.utils.samples import load_data

pytestmark = [requires_snuba]


class OrganizationOnboardingTaskTest(TestCase):
    @assume_test_silo_mode(SiloMode.CONTROL)
    def create_integration(self, provider, external_id=9999):
        return self.create_provider_integration(
            provider=provider,
            name="test",
            external_id=external_id,
        )

    def test_no_existing_task(self):
        now = timezone.now()
        project = self.create_project(first_event=now)
        event = self.store_event(data={}, project_id=project.id)
        first_event_received.send(project=project, event=event, sender=type(project))

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization, task=OnboardingTask.FIRST_EVENT
        )
        assert task.status == OnboardingTaskStatus.COMPLETE
        assert task.project_id == project.id
        assert task.date_completed == project.first_event

    def test_existing_complete_task(self):
        now = timezone.now()
        project = self.create_project(first_event=now)
        task = OrganizationOnboardingTask.objects.create(
            organization=project.organization,
            task=OnboardingTask.FIRST_PROJECT,
            status=OnboardingTaskStatus.COMPLETE,
        )

        event = self.store_event(data={}, project_id=project.id)
        first_event_received.send(project=project, event=event, sender=type(project))

        task = OrganizationOnboardingTask.objects.get(id=task.id)
        assert task.status == OnboardingTaskStatus.COMPLETE
        assert not task.project_id

    # Tests on the receivers
    def test_event_processed(self):
        now = timezone.now()
        project = self.create_project(first_event=now)
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "platform": "javascript",
                "timestamp": before_now(minutes=1).isoformat(),
                "tags": {
                    "sentry:user": "id:41656",
                },
                "release": "e1b5d1900526feaf20fe2bc9cad83d392136030a",
                "user": {"ip_address": "0.0.0.0", "id": "41656", "email": "test@example.com"},
                "exception": {
                    "values": [
                        {
                            "stacktrace": {
                                "frames": [
                                    {
                                        "data": {
                                            "sourcemap": "https://media.sentry.io/_static/29e365f8b0d923bc123e8afa38d890c3/sentry/dist/vendor.js.map"
                                        }
                                    }
                                ]
                            },
                            "type": "TypeError",
                        }
                    ]
                },
            },
            project_id=project.id,
        )

        event_processed.send(project=project, event=event, sender=type(project))

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.RELEASE_TRACKING,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.USER_CONTEXT,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.SOURCEMAPS,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

    def test_project_created(self):
        now = timezone.now()
        project = self.create_project(first_event=now)
        project_created.send(project=project, user=self.user, sender=type(project))

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.FIRST_PROJECT,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

    def test_first_event_received(self):
        now = timezone.now()
        project = self.create_project(first_event=now)
        project_created.send(project=project, user=self.user, sender=type(project))
        event = self.store_event(
            data={"platform": "javascript", "message": "javascript error message"},
            project_id=project.id,
        )
        first_event_received.send(project=project, event=event, sender=type(project))

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.FIRST_EVENT,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None
        assert "platform" in task.data
        assert task.data["platform"] == "javascript"

        second_project = self.create_project(first_event=now)
        project_created.send(project=second_project, user=self.user, sender=type(second_project))
        second_task = OrganizationOnboardingTask.objects.get(
            organization=second_project.organization,
            task=OnboardingTask.SECOND_PLATFORM,
            status=OnboardingTaskStatus.PENDING,
        )
        assert second_task is not None

        second_event = self.store_event(
            data={"platform": "python", "message": "python error message"},
            project_id=second_project.id,
        )
        first_event_received.send(
            project=second_project, event=second_event, sender=type(second_project)
        )
        second_task = OrganizationOnboardingTask.objects.get(
            organization=second_project.organization,
            task=OnboardingTask.SECOND_PLATFORM,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert second_task is not None
        assert "platform" in second_task.data
        assert second_task.data["platform"] == "python"
        assert task.data["platform"] != second_task.data["platform"]

    def test_first_transaction_received(self):
        project = self.create_project()

        event_data = load_data("transaction")
        min_ago = before_now(minutes=1).isoformat()
        event_data.update({"start_timestamp": min_ago, "timestamp": min_ago})

        event = self.store_event(data=event_data, project_id=project.id)

        first_event_received.send(project=project, event=event, sender=type(project))
        first_transaction_received.send(project=project, event=event, sender=type(project))

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.FIRST_TRANSACTION,
            status=OnboardingTaskStatus.COMPLETE,
        )

        assert task is not None

        assert project.flags.has_transactions

    def test_member_invited(self):
        user = self.create_user(email="test@example.org")
        member = self.create_member(
            organization=self.organization, teams=[self.team], email=user.email
        )
        member_invited.send(member=member, user=user, sender=type(member))

        task = OrganizationOnboardingTask.objects.get(
            organization=self.organization,
            task=OnboardingTask.INVITE_MEMBER,
            status=OnboardingTaskStatus.PENDING,
        )
        assert task is not None

    def test_member_joined(self):
        user = self.create_user(email="test@example.org")

        with pytest.raises(OrganizationOnboardingTask.DoesNotExist):
            OrganizationOnboardingTask.objects.get(
                organization=self.organization,
                task=OnboardingTask.INVITE_MEMBER,
                status=OnboardingTaskStatus.COMPLETE,
            )

        om = self.create_member(
            organization=self.organization, teams=[self.team], email="someemail@example.com"
        )
        invite = organization_service.get_invite_by_id(
            organization_member_id=om.id, organization_id=om.organization_id
        )
        assert invite is not None
        helper = ApiInviteHelper(
            self.make_request(user=user),
            invite,
            None,
        )

        with pytest.raises(OrganizationOnboardingTask.DoesNotExist):
            OrganizationOnboardingTask.objects.get(
                organization=self.organization,
                task=OnboardingTask.INVITE_MEMBER,
                status=OnboardingTaskStatus.COMPLETE,
            )

        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            helper.accept_invite(user=user)

        task = OrganizationOnboardingTask.objects.get(
            organization=self.organization,
            task=OnboardingTask.INVITE_MEMBER,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

        user2 = self.create_user(email="test@example.com")
        om2 = self.create_member(
            organization=self.organization, teams=[self.team], email="blah@example.com"
        )
        invite = organization_service.get_invite_by_id(
            organization_member_id=om2.id, organization_id=om2.organization_id
        )
        assert invite is not None
        helper = ApiInviteHelper(
            self.make_request(user=user2),
            invite,
            None,
        )

        with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
            helper.accept_invite(user=user2)

        task = OrganizationOnboardingTask.objects.get(
            organization=self.organization,
            task=OnboardingTask.INVITE_MEMBER,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task.data["invited_member_id"] == om.id

    def test_issue_tracker_onboarding(self):
        plugin_enabled.send(
            plugin=IssueTrackingPlugin(),
            project=self.project,
            user=self.user,
            sender=type(IssueTrackingPlugin),
        )
        task = OrganizationOnboardingTask.objects.get(
            organization=self.organization,
            task=OnboardingTask.ISSUE_TRACKER,
            status=OnboardingTaskStatus.PENDING,
        )
        assert task is not None

        issue_tracker_used.send(
            plugin=IssueTrackingPlugin(),
            project=self.project,
            user=self.user,
            sender=type(IssueTrackingPlugin),
        )
        task = OrganizationOnboardingTask.objects.get(
            organization=self.organization,
            task=OnboardingTask.ISSUE_TRACKER,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

    def test_alert_added(self):
        alert_rule_created.send(
            rule_id=Rule(id=1).id,
            project=self.project,
            user=self.user,
            rule_type="issue",
            sender=type(Rule),
            is_api_token=False,
        )
        task = OrganizationOnboardingTask.objects.get(
            organization=self.organization,
            task=OnboardingTask.ALERT_RULE,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

    def test_integration_added(self):
        integration_added.send(
            integration_id=self.create_integration("slack", 1234).id,
            organization_id=self.organization.id,
            user_id=self.user.id,
            sender=None,
        )
        task = OrganizationOnboardingTask.objects.get(
            organization=self.organization,
            task=OnboardingTask.INTEGRATIONS,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None
        assert task.data["providers"] == ["slack"]

        # Adding a second integration
        integration_added.send(
            integration_id=self.create_integration("github", 4567).id,
            organization_id=self.organization.id,
            user_id=self.user.id,
            sender=None,
        )
        task = OrganizationOnboardingTask.objects.get(
            organization=self.organization,
            task=OnboardingTask.INTEGRATIONS,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert "slack" in task.data["providers"]
        assert "github" in task.data["providers"]
        assert len(task.data["providers"]) == 2

        # Installing an integration a second time doesn't produce
        # duplicated providers in the list
        integration_added.send(
            integration_id=self.create_integration("slack", 4747).id,
            organization_id=self.organization.id,
            user_id=self.user.id,
            sender=None,
        )
        task = OrganizationOnboardingTask.objects.get(
            organization=self.organization,
            task=OnboardingTask.INTEGRATIONS,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert "slack" in task.data["providers"]
        assert "github" in task.data["providers"]
        assert len(task.data["providers"]) == 2

    def test_metric_added(self):
        alert_rule_created.send(
            rule_id=Rule(id=1).id,
            project=self.project,
            user=self.user,
            rule_type="metric",
            sender=type(Rule),
            is_api_token=False,
        )
        task = OrganizationOnboardingTask.objects.get(
            organization=self.organization,
            task=OnboardingTask.METRIC_ALERT,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

    @patch("sentry.analytics.record")
    def test_onboarding_complete(self, record_analytics):
        now = timezone.now()
        user = self.create_user(email="test@example.org")
        project = self.create_project(first_event=now)
        second_project = self.create_project(first_event=now)
        second_event = self.store_event(
            data={"platform": "python", "message": "python error message"},
            project_id=second_project.id,
        )
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "platform": "javascript",
                "timestamp": before_now(minutes=1).isoformat(),
                "tags": {
                    "sentry:user": "id:41656",
                },
                "release": "e1b5d1900526feaf20fe2bc9cad83d392136030a",
                "user": {"ip_address": "0.0.0.0", "id": "41656", "email": "test@example.com"},
                "exception": {
                    "values": [
                        {
                            "stacktrace": {
                                "frames": [
                                    {
                                        "data": {
                                            "sourcemap": "https://media.sentry.io/_static/29e365f8b0d923bc123e8afa38d890c3/sentry/dist/vendor.js.map"
                                        }
                                    }
                                ]
                            },
                            "type": "TypeError",
                        }
                    ]
                },
            },
            project_id=project.id,
        )

        event_data = load_data("transaction")
        min_ago = before_now(minutes=1).isoformat()
        event_data.update({"start_timestamp": min_ago, "timestamp": min_ago})

        transaction = self.store_event(data=event_data, project_id=project.id)

        first_event_received.send(project=project, event=transaction, sender=type(project))
        first_transaction_received.send(project=project, event=transaction, sender=type(project))

        member = self.create_member(organization=self.organization, teams=[self.team], user=user)

        event_processed.send(project=project, event=event, sender=type(project))
        project_created.send(project=project, user=user, sender=type(project))
        project_created.send(project=second_project, user=user, sender=type(second_project))

        first_event_received.send(project=project, event=event, sender=type(project))
        first_event_received.send(
            project=second_project, event=second_event, sender=type(second_project)
        )
        member_joined.send(
            organization_member_id=member.id,
            organization_id=self.organization.id,
            user_id=member.user_id,
            sender=None,
        )
        plugin_enabled.send(
            plugin=IssueTrackingPlugin(),
            project=project,
            user=user,
            sender=type(IssueTrackingPlugin),
        )
        issue_tracker_used.send(
            plugin=IssueTrackingPlugin(),
            project=project,
            user=user,
            sender=type(IssueTrackingPlugin),
        )
        integration_added.send(
            integration_id=self.create_integration("slack").id,
            organization_id=self.organization.id,
            user_id=user.id,
            sender=None,
        )
        alert_rule_created.send(
            rule_id=Rule(id=1).id,
            project=self.project,
            user=self.user,
            rule_type="issue",
            sender=type(Rule),
            is_api_token=False,
        )
        alert_rule_created.send(
            rule_id=Rule(id=1).id,
            project=self.project,
            user=self.user,
            rule_type="metric",
            sender=type(Rule),
            is_api_token=False,
        )
        first_replay_received.send(project=project, sender=type(project))

        assert (
            OrganizationOption.objects.filter(
                organization=self.organization, key="onboarding:complete"
            ).count()
            == 1
        )

        record_analytics.assert_called_with(
            "onboarding.complete",
            user_id=self.organization.default_owner_id,
            organization_id=self.organization.id,
            referrer="onboarding_tasks",
        )

    @patch("sentry.analytics.record")
    def test_first_event_without_minified_stack_trace_received(self, record_analytics):
        """
        Test that an analytics event is NOT recorded when
        there no event with minified stack trace is received
        """
        now = timezone.now()
        project = self.create_project(first_event=now)
        project_created.send(project=project, user=self.user, sender=type(project))
        data = load_data("javascript")
        self.store_event(
            data=data,
            project_id=project.id,
        )

        with pytest.raises(AssertionError):
            record_analytics.assert_called_with(
                "first_event_with_minified_stack_trace_for_project.sent",
                user_id=self.user.id,
                organization_id=project.organization_id,
                project_id=project.id,
                platform="javascript",
                url="http://localhost:3000",
            )

    @patch("sentry.analytics.record")
    def test_first_event_with_minified_stack_trace_received(self, record_analytics):
        """
        Test that an analytics event is recorded when
        a first event with minified stack trace is received
        """
        now = timezone.now()
        project = self.create_project(first_event=now, platform="VueJS")
        project_created.send(project=project, user=self.user, sender=type(project))
        url = "http://localhost:3000"
        event = load_data("javascript")
        event["tags"] = [("url", url)]
        event["exception"] = {
            "values": [
                {
                    **event["exception"]["values"][0],
                    "raw_stacktrace": {
                        "frames": [
                            {
                                "function": "o",
                                "filename": "/_static/dist/sentry/chunks/vendors-node_modules_emotion_is-prop-valid_node_modules_emotion_memoize_dist_memoize_browser_-4fe4bd.255071ceadabfb67483c.js",
                                "abs_path": "https://s1.sentry-cdn.com/_static/dist/sentry/chunks/vendors-node_modules_emotion_is-prop-valid_node_modules_emotion_memoize_dist_memoize_browser_-4fe4bd.255071ceadabfb67483c.js",
                                "lineno": 2,
                                "colno": 37098,
                                "pre_context": [
                                    "/*! For license information please see vendors-node_modules_emotion_is-prop-valid_node_modules_emotion_memoize_dist_memoize_browser_-4fe4bd. {snip}"
                                ],
                                "context_line": "{snip} .apply(this,arguments);const i=o.map((e=>c(e,t)));return e.apply(this,i)}catch(e){throw l(),(0,i.$e)((n=>{n.addEventProcessor((e=>(t.mechani {snip}",
                                "post_context": [
                                    "//# sourceMappingURL=../sourcemaps/vendors-node_modules_emotion_is-prop-valid_node_modules_emotion_memoize_dist_memoize_browser_-4fe4bd.fe32 {snip}"
                                ],
                                "in_app": False,
                            },
                        ],
                    },
                }
            ]
        }

        self.store_event(
            project_id=project.id,
            data=event,
        )

        record_analytics.assert_called_with(
            "first_event_with_minified_stack_trace_for_project.sent",
            user_id=self.user.id,
            organization_id=project.organization_id,
            project_id=project.id,
            platform=event["platform"],
            project_platform="VueJS",
            url=url,
        )

    @patch("sentry.analytics.record")
    def test_analytic_triggered_only_once_if_multiple_events_with_minified_stack_trace_received(
        self, record_analytics
    ):
        """
        Test that an analytic event is triggered only once when
        multiple events with minified stack trace are received
        """
        now = timezone.now()
        project = self.create_project(first_event=now)
        project_created.send(project=project, user=self.user, sender=type(project))
        url = "http://localhost:3000"
        event = load_data("javascript")
        event["tags"] = [("url", url)]
        event["exception"] = {
            "values": [
                {
                    **event["exception"]["values"][0],
                    "raw_stacktrace": {
                        "frames": [
                            {
                                "function": "o",
                                "filename": "/_static/dist/sentry/chunks/vendors-node_modules_emotion_is-prop-valid_node_modules_emotion_memoize_dist_memoize_browser_-4fe4bd.255071ceadabfb67483c.js",
                                "abs_path": "https://s1.sentry-cdn.com/_static/dist/sentry/chunks/vendors-node_modules_emotion_is-prop-valid_node_modules_emotion_memoize_dist_memoize_browser_-4fe4bd.255071ceadabfb67483c.js",
                                "lineno": 2,
                                "colno": 37098,
                                "pre_context": [
                                    "/*! For license information please see vendors-node_modules_emotion_is-prop-valid_node_modules_emotion_memoize_dist_memoize_browser_-4fe4bd. {snip}"
                                ],
                                "context_line": "{snip} .apply(this,arguments);const i=o.map((e=>c(e,t)));return e.apply(this,i)}catch(e){throw l(),(0,i.$e)((n=>{n.addEventProcessor((e=>(t.mechani {snip}",
                                "post_context": [
                                    "//# sourceMappingURL=../sourcemaps/vendors-node_modules_emotion_is-prop-valid_node_modules_emotion_memoize_dist_memoize_browser_-4fe4bd.fe32 {snip}"
                                ],
                                "in_app": False,
                            },
                        ],
                    },
                }
            ]
        }

        # Store first event
        self.store_event(
            project_id=project.id,
            data=event,
        )

        # Store second event
        self.store_event(
            project_id=project.id,
            data=event,
        )

        count = 0
        for call_arg in record_analytics.call_args_list:
            if "first_event_with_minified_stack_trace_for_project.sent" in call_arg[0]:
                count += 1

        assert count == 1

    @patch("sentry.analytics.record")
    def test_old_project_sending_minified_stack_trace_event(self, record_analytics):
        """
        Test that an analytics event is NOT recorded when
        the project creation date is older than the date we defined (START_DATE_TRACKING_FIRST_EVENT_WITH_MINIFIED_STACK_TRACE_PER_PROJ).

        In this test we also check  if the has_minified_stack_trace is being set to "True" in old projects
        """
        old_date = datetime(2022, 12, 10, tzinfo=UTC)
        project = self.create_project(first_event=old_date, date_added=old_date)
        project_created.send(project=project, user=self.user, sender=type(project))
        url = "http://localhost:3000"
        event = load_data("javascript")
        event["tags"] = [("url", url)]
        event["exception"] = {
            "values": [
                {
                    **event["exception"]["values"][0],
                    "raw_stacktrace": {
                        "frames": [
                            {
                                "function": "o",
                                "filename": "/_static/dist/sentry/chunks/vendors-node_modules_emotion_is-prop-valid_node_modules_emotion_memoize_dist_memoize_browser_-4fe4bd.255071ceadabfb67483c.js",
                                "abs_path": "https://s1.sentry-cdn.com/_static/dist/sentry/chunks/vendors-node_modules_emotion_is-prop-valid_node_modules_emotion_memoize_dist_memoize_browser_-4fe4bd.255071ceadabfb67483c.js",
                                "lineno": 2,
                                "colno": 37098,
                                "pre_context": [
                                    "/*! For license information please see vendors-node_modules_emotion_is-prop-valid_node_modules_emotion_memoize_dist_memoize_browser_-4fe4bd. {snip}"
                                ],
                                "context_line": "{snip} .apply(this,arguments);const i=o.map((e=>c(e,t)));return e.apply(this,i)}catch(e){throw l(),(0,i.$e)((n=>{n.addEventProcessor((e=>(t.mechani {snip}",
                                "post_context": [
                                    "//# sourceMappingURL=../sourcemaps/vendors-node_modules_emotion_is-prop-valid_node_modules_emotion_memoize_dist_memoize_browser_-4fe4bd.fe32 {snip}"
                                ],
                                "in_app": False,
                            },
                        ],
                    },
                }
            ]
        }

        def _project_has_minified_stack_trace(p: Project) -> bool:
            return p.flags.has_minified_stack_trace

        assert not _project_has_minified_stack_trace(project)

        # Store event
        self.store_event(
            project_id=project.id,
            data=event,
        )

        project.refresh_from_db()

        assert _project_has_minified_stack_trace(project)

        # The analytic's event "first_event_with_minified_stack_trace_for_project" shall not be sent
        count = 0
        for call_arg in record_analytics.call_args_list:
            if "first_event_with_minified_stack_trace_for_project.sent" in call_arg[0]:
                count += 1

        assert count == 0

    @patch("sentry.analytics.record")
    def test_first_event_without_sourcemaps_received(self, record_analytics):
        """
        Test that an analytics event is NOT recorded when
        no event with sourcemaps is received
        """
        now = timezone.now()
        project = self.create_project(first_event=now)
        project_created.send(project=project, user=self.user, sender=type(project))
        data = load_data("javascript")
        data["exception"] = {
            "values": [
                {
                    "stacktrace": {"frames": [{"data": {}}]},
                    "type": "TypeError",
                }
            ]
        }
        event = self.store_event(
            project_id=project.id,
            data=data,
        )

        event_processed.send(project=project, event=event, sender=type(project))

        count = 0
        for call_arg in record_analytics.call_args_list:
            if "first_sourcemaps_for_project.sent" in call_arg[0]:
                count += 1

        assert count == 0

    @patch("sentry.analytics.record")
    def test_first_event_with_sourcemaps_received(self, record_analytics):
        """
        Test that an analytics event is recorded when
        a first event with sourcemaps is received
        """
        now = timezone.now()
        project = self.create_project(first_event=now, platform="VueJS")
        project_created.send(project=project, user=self.user, sender=type(project))
        url = "http://localhost:3000"
        data = load_data("javascript")
        data["tags"] = [("url", url)]
        data["exception"] = {
            "values": [
                {
                    "stacktrace": {
                        "frames": [
                            {
                                "data": {
                                    "sourcemap": "https://media.sentry.io/_static/29e365f8b0d923bc123e8afa38d890c3/sentry/dist/vendor.js.map"
                                }
                            }
                        ]
                    },
                    "type": "TypeError",
                }
            ]
        }

        event = self.store_event(
            project_id=project.id,
            data=data,
        )
        event_processed.send(project=project, event=event, sender=type(project))

        record_analytics.assert_called_with(
            "first_sourcemaps_for_project.sent",
            user_id=self.user.id,
            organization_id=project.organization_id,
            project_id=project.id,
            platform=event.platform,
            project_platform="VueJS",
            url=url,
        )

    @patch("sentry.analytics.record")
    def test_analytic_triggered_only_once_if_multiple_events_with_sourcemaps_received(
        self, record_analytics
    ):
        """
        Test that an analytic event is triggered only once when
        multiple events with sourcemaps are received
        """
        now = timezone.now()
        project = self.create_project(first_event=now)
        project_created.send(project=project, user=self.user, sender=type(project))
        url = "http://localhost:3000"
        data = load_data("javascript")
        data["tags"] = [("url", url)]
        data["exception"] = {
            "values": [
                {
                    "stacktrace": {
                        "frames": [
                            {
                                "data": {
                                    "sourcemap": "https://media.sentry.io/_static/29e365f8b0d923bc123e8afa38d890c3/sentry/dist/vendor.js.map"
                                }
                            }
                        ]
                    },
                    "type": "TypeError",
                }
            ]
        }

        # Store first event
        event_1 = self.store_event(
            project_id=project.id,
            data=data,
        )
        event_processed.send(project=project, event=event_1, sender=type(project))

        # Store second event
        event_2 = self.store_event(
            project_id=project.id,
            data=data,
        )
        event_processed.send(project=project, event=event_2, sender=type(project))

        count = 0
        for call_arg in record_analytics.call_args_list:
            if "first_sourcemaps_for_project.sent" in call_arg[0]:
                count += 1

        assert count == 1

    @patch("sentry.analytics.record")
    def test_old_project_sending_sourcemap_event(self, record_analytics):
        """
        Test that an analytics event is NOT recorded when
        the project creation date is older than the date we defined (START_DATE_TRACKING_FIRST_EVENT_WITH_SOURCEMAPS_PER_PROJ).

        In this test we also check  if the has_sourcemaps is being set to "True" in old projects
        """
        old_date = datetime(2022, 12, 10, tzinfo=UTC)
        project = self.create_project(first_event=old_date, date_added=old_date)
        project_created.send(project=project, user=self.user, sender=type(project))
        url = "http://localhost:3000"
        data = load_data("javascript")
        data["tags"] = [("url", url)]
        data["exception"] = {
            "values": [
                {
                    "stacktrace": {
                        "frames": [
                            {
                                "data": {
                                    "sourcemap": "https://media.sentry.io/_static/29e365f8b0d923bc123e8afa38d890c3/sentry/dist/vendor.js.map"
                                }
                            }
                        ]
                    },
                    "type": "TypeError",
                }
            ]
        }

        def _project_has_sourcemaps(p: Project) -> bool:
            return project.flags.has_sourcemaps

        assert not _project_has_sourcemaps(project)

        event = self.store_event(project_id=project.id, data=data)
        event_processed.send(project=project, event=event, sender=type(project))

        project.refresh_from_db()

        assert _project_has_sourcemaps(project)

        # The analytic's event "first_event_with_minified_stack_trace_for_project" shall not be sent
        count = 0
        for call_arg in record_analytics.call_args_list:
            if "first_sourcemaps_for_project.sent" in call_arg[0]:
                count += 1

        assert count == 0

    @patch("sentry.analytics.record")
    def test_real_time_notifications_added(self, record_analytics):
        with self.feature("organizations:quick-start-updates"):
            integration_id = self.create_integration("slack", 123).id
            integration_added.send(
                integration_id=integration_id,
                organization_id=self.organization.id,
                user_id=self.user.id,
                sender=None,
            )
            task = OrganizationOnboardingTask.objects.get(
                organization=self.organization,
                task=OnboardingTask.REAL_TIME_NOTIFICATIONS,
                status=OnboardingTaskStatus.COMPLETE,
            )
            assert task is not None

            record_analytics.assert_called_with(
                "integration.added",
                user_id=self.user.id,
                default_user_id=self.organization.default_owner_id,
                organization_id=self.organization.id,
                id=integration_id,
                provider="slack",
            )

    @patch("sentry.analytics.record")
    def test_source_code_management_added(self, record_analytics):
        with self.feature("organizations:quick-start-updates"):
            integration_id = self.create_integration("github", 123).id
            integration_added.send(
                integration_id=integration_id,
                organization_id=self.organization.id,
                user_id=self.user.id,
                sender=None,
            )
            task = OrganizationOnboardingTask.objects.get(
                organization=self.organization,
                task=OnboardingTask.LINK_SENTRY_TO_SOURCE_CODE,
                status=OnboardingTaskStatus.COMPLETE,
            )
            assert task is not None

            record_analytics.assert_called_with(
                "integration.added",
                user_id=self.user.id,
                default_user_id=self.organization.default_owner_id,
                organization_id=self.organization.id,
                id=integration_id,
                provider="github",
            )

    def test_second_platform_complete(self):
        with self.feature("organizations:quick-start-updates"):
            now = timezone.now()
            project = self.create_project(first_event=now)
            second_project = self.create_project(first_event=now)

            project_created.send(project=project, user=self.user, sender=type(project))
            project_created.send(
                project=second_project, user=self.user, sender=type(second_project)
            )

            task = OrganizationOnboardingTask.objects.get(
                organization=self.organization,
                task=OnboardingTask.SECOND_PLATFORM,
                status=OnboardingTaskStatus.COMPLETE,
            )
            assert task is not None

    def test_release_received_through_transaction_event(self):
        project = self.create_project()

        event_data = load_data("transaction")
        event_data.update({"release": "my-first-release", "tags": []})

        event = self.store_event(data=event_data, project_id=project.id)
        event_processed.send(project=project, event=event, sender=type(project))

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.RELEASE_TRACKING,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

    def test_issue_alert_received_through_project_creation(self):
        with self.feature("organizations:quick-start-updates"):
            now = timezone.now()

            first_organization = self.create_organization(owner=self.user, slug="first-org")
            first_project = self.create_project(first_event=now, organization=first_organization)
            # By default, the project creation will create a default rule
            project_created.send(project=first_project, user=self.user, sender=type(first_project))
            assert OrganizationOnboardingTask.objects.filter(
                organization=first_project.organization,
                task=OnboardingTask.ALERT_RULE,
                status=OnboardingTaskStatus.COMPLETE,
            ).exists()

            second_organization = self.create_organization(owner=self.user, slug="second-org")
            second_project = self.create_project(first_event=now, organization=second_organization)
            # When creating a project, a user can opt out of creating a default rule
            project_created.send(
                project=second_project,
                user=self.user,
                sender=type(second_project),
                default_rules=False,
            )
            assert not OrganizationOnboardingTask.objects.filter(
                organization=second_project.organization,
                task=OnboardingTask.ALERT_RULE,
                status=OnboardingTaskStatus.COMPLETE,
            ).exists()

    # New quick start
    @patch("sentry.analytics.record")
    def test_new_onboarding_complete(self, record_analytics):
        """
        Test the new quick start happy path (without source maps)
        """
        with self.feature("organizations:quick-start-updates"):
            # Create first project
            project = self.create_project(platform="python")
            project_created.send(
                project=project, user=self.user, default_rules=False, sender=type(project)
            )
            assert (
                OrganizationOnboardingTask.objects.get(
                    organization=self.organization,
                    task=OnboardingTask.FIRST_PROJECT,
                    status=OnboardingTaskStatus.COMPLETE,
                )
                is not None
            )
            record_analytics.assert_called_with(
                "project.created",
                user_id=self.user.id,
                default_user_id=self.organization.default_owner_id,
                organization_id=self.organization.id,
                project_id=project.id,
                platform=project.platform,
                updated_empty_state=False,
            )

            # Set up tracing
            transaction_event = load_data("transaction")
            transaction_event.update({"user": None})
            event = self.store_event(data=transaction_event, project_id=project.id)
            transaction_processed.send(project=project, event=event, sender=type(project))
            assert (
                OrganizationOnboardingTask.objects.get(
                    organization=self.organization,
                    task=OnboardingTask.FIRST_TRANSACTION,
                    status=OnboardingTaskStatus.COMPLETE,
                )
                is not None
            )
            record_analytics.assert_called_with(
                "first_transaction.sent",
                default_user_id=self.organization.default_owner_id,
                organization_id=self.organization.id,
                project_id=project.id,
                platform=project.platform,
            )

            #  Capture first error
            error_event = self.store_event(
                data={
                    "event_id": "c" * 32,
                    "message": "this is bad.",
                    "timestamp": iso_format(timezone.now()),
                    "type": "error",
                },
                project_id=project.id,
            )
            event_processed.send(project=project, event=error_event, sender=type(project))
            assert (
                OrganizationOnboardingTask.objects.get(
                    organization=self.organization,
                    task=OnboardingTask.FIRST_EVENT,
                    status=OnboardingTaskStatus.COMPLETE,
                )
                is not None
            )
            record_analytics.assert_called_with(
                "first_event.sent",
                user_id=self.user.id,
                organization_id=project.organization_id,
                project_id=project.id,
                platform=error_event.platform,
                project_platform=project.platform,
            )

            # Configure an issue alert
            alert_rule_created.send(
                rule_id=Rule(id=1).id,
                project=project,
                user=self.user,
                rule_type="issue",
                sender=type(Rule),
                is_api_token=False,
            )
            assert (
                OrganizationOnboardingTask.objects.get(
                    organization=self.organization,
                    task=OnboardingTask.ALERT_RULE,
                    status=OnboardingTaskStatus.COMPLETE,
                )
                is not None
            )
            record_analytics.assert_called_with(
                "alert.created",
                user_id=self.user.id,
                default_user_id=self.organization.default_owner_id,
                organization_id=self.organization.id,
                project_id=project.id,
                rule_id=Rule(id=1).id,
                rule_type="issue",
                referrer=None,
                session_id=None,
                is_api_token=False,
                alert_rule_ui_component=None,
                duplicate_rule=None,
                wizard_v3=None,
                query_type=None,
            )

            # Track releases
            transaction_event = load_data("transaction")
            transaction_event.update({"release": "my-first-release", "tags": []})
            event = self.store_event(data=transaction_event, project_id=project.id)
            transaction_processed.send(project=project, event=event, sender=type(project))
            assert (
                OrganizationOnboardingTask.objects.get(
                    organization=self.organization,
                    task=OnboardingTask.RELEASE_TRACKING,
                    status=OnboardingTaskStatus.COMPLETE,
                )
                is not None
            )
            record_analytics.call_args_list[
                len(record_analytics.call_args_list) - 2
            ].assert_called_with(
                "first_release_tag.sent",
                user_id=self.user.id,
                project_id=project.id,
                organization_id=self.organization.id,
            )

            # Link Sentry to source code
            github_integration = self.create_integration("github", 1234)
            integration_added.send(
                integration_id=github_integration.id,
                organization_id=self.organization.id,
                user_id=self.user.id,
                sender=None,
            )
            assert (
                OrganizationOnboardingTask.objects.get(
                    organization=self.organization,
                    task=OnboardingTask.LINK_SENTRY_TO_SOURCE_CODE,
                    status=OnboardingTaskStatus.COMPLETE,
                )
                is not None
            )
            record_analytics.assert_called_with(
                "integration.added",
                user_id=self.user.id,
                default_user_id=self.organization.default_owner_id,
                organization_id=self.organization.id,
                provider=github_integration.provider,
                id=github_integration.id,
            )

            # Invite your team
            user = self.create_user(email="test@example.org")
            member = self.create_member(
                organization=self.organization, teams=[self.team], email=user.email
            )
            member_invited.send(member=member, user=user, sender=type(member))
            assert (
                OrganizationOnboardingTask.objects.get(
                    organization=self.organization,
                    task=OnboardingTask.INVITE_MEMBER,
                    status=OnboardingTaskStatus.PENDING,
                )
                is not None
            )
            record_analytics.assert_called_with(
                "member.invited",
                invited_member_id=member.id,
                inviter_user_id=user.id,
                organization_id=self.organization.id,
                referrer=None,
            )

            # Member accepted the invite
            member_joined.send(
                organization_member_id=member.id,
                organization_id=self.organization.id,
                user_id=member.user_id,
                sender=None,
            )
            assert (
                OrganizationOnboardingTask.objects.get(
                    organization=self.organization,
                    task=OnboardingTask.INVITE_MEMBER,
                    status=OnboardingTaskStatus.COMPLETE,
                )
                is not None
            )
            record_analytics.assert_called_with(
                "organization.joined",
                user_id=None,
                organization_id=self.organization.id,
            )

            # The first group is complete but the beyond the basics is not
            assert (
                OrganizationOption.objects.filter(
                    organization=self.organization, key="onboarding:complete"
                ).count()
                == 0
            )

            # Set up session replay
            first_replay_received.send(project=project, sender=type(project))
            assert (
                OrganizationOnboardingTask.objects.get(
                    organization=self.organization,
                    task=OnboardingTask.SESSION_REPLAY,
                    status=OnboardingTaskStatus.COMPLETE,
                )
                is not None
            )
            record_analytics.assert_called_with(
                "first_replay.sent",
                user_id=self.user.id,
                organization_id=project.organization_id,
                project_id=project.id,
                platform=project.platform,
            )

            # Get real time notifications
            slack_integration = self.create_integration("slack", 4321)
            integration_added.send(
                integration_id=slack_integration.id,
                organization_id=self.organization.id,
                user_id=self.user.id,
                sender=None,
            )
            assert (
                OrganizationOnboardingTask.objects.get(
                    organization=self.organization,
                    task=OnboardingTask.REAL_TIME_NOTIFICATIONS,
                    status=OnboardingTaskStatus.COMPLETE,
                )
                is not None
            )
            record_analytics.assert_called_with(
                "integration.added",
                user_id=self.user.id,
                default_user_id=self.organization.default_owner_id,
                organization_id=self.organization.id,
                provider=slack_integration.provider,
                id=slack_integration.id,
            )

            # Add Sentry to other parts app
            second_project = self.create_project(
                first_event=timezone.now(), organization=self.organization
            )
            project_created.send(
                project=second_project,
                user=self.user,
                sender=type(second_project),
                default_rules=False,
            )
            assert (
                OrganizationOnboardingTask.objects.get(
                    organization=self.organization,
                    task=OnboardingTask.SECOND_PLATFORM,
                    status=OnboardingTaskStatus.COMPLETE,
                )
                is not None
            )
            record_analytics.call_args_list[
                len(record_analytics.call_args_list) - 2
            ].assert_called_with(
                "second_platform.added",
                user_id=self.user.id,
                organization_id=self.organization.id,
                project_id=second_project.id,
            )

            # Onboarding is complete
            assert (
                OrganizationOption.objects.filter(
                    organization=self.organization, key="onboarding:complete"
                ).count()
                == 1
            )
            record_analytics.assert_called_with(
                "onboarding.complete",
                user_id=self.user.id,
                organization_id=self.organization.id,
                referrer="onboarding_tasks",
            )

    @patch("sentry.analytics.record")
    def test_source_maps_as_required_task(self, record_analytics):
        """
        Test the new quick start happy path (with source maps)
        """
        with self.feature("organizations:quick-start-updates"):
            # Create a project that can have source maps + create an issue alert
            project = self.create_project(platform="javascript")
            project_created.send(project=project, user=self.user, sender=type(project))

            # Capture first transaction + release
            transaction_event = load_data("transaction")
            transaction_event.update({"release": "my-first-release", "tags": []})
            event = self.store_event(data=transaction_event, project_id=project.id)
            transaction_processed.send(project=project, event=event, sender=type(project))

            #  Capture first error
            error_event = self.store_event(
                data={
                    "event_id": "c" * 32,
                    "message": "this is bad.",
                    "timestamp": iso_format(timezone.now()),
                    "type": "error",
                    "release": "my-first-release",
                },
                project_id=project.id,
            )
            event_processed.send(project=project, event=error_event, sender=type(project))

            # Invite your team
            user = self.create_user(email="test@example.org")
            member = self.create_member(
                organization=self.organization, teams=[self.team], email=user.email
            )
            member_invited.send(member=member, user=user, sender=type(member))

            # Member accepted the invite
            member_joined.send(
                organization_member_id=member.id,
                organization_id=self.organization.id,
                user_id=member.user_id,
                sender=None,
            )

            # Link Sentry to source code
            github_integration = self.create_integration("github", 1234)
            integration_added.send(
                integration_id=github_integration.id,
                organization_id=self.organization.id,
                user_id=self.user.id,
                sender=None,
            )

            # Set up session replay
            first_replay_received.send(project=project, sender=type(project))

            # Get real time notifications
            slack_integration = self.create_integration("slack", 4321)
            integration_added.send(
                integration_id=slack_integration.id,
                organization_id=self.organization.id,
                user_id=self.user.id,
                sender=None,
            )

            # Add Sentry to other parts app
            second_project = self.create_project(
                first_event=timezone.now(), organization=self.organization
            )
            project_created.send(
                project=second_project,
                user=self.user,
                sender=type(second_project),
                default_rules=False,
            )

            # Onboarding is NOT yet complete
            assert (
                OrganizationOption.objects.filter(
                    organization=self.organization, key="onboarding:complete"
                ).count()
                == 0
            )

            # Unminify your code
            # Send event with source map
            data = load_data("javascript")
            data["exception"] = {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "data": {
                                        "sourcemap": "https://media.sentry.io/_static/29e365f8b0d923bc123e8afa38d890c3/sentry/dist/vendor.js.map"
                                    }
                                }
                            ]
                        },
                        "type": "TypeError",
                    }
                ]
            }

            event_with_sourcemap = self.store_event(
                project_id=project.id,
                data=data,
            )
            event_processed.send(project=project, event=event_with_sourcemap, sender=type(project))
            assert (
                OrganizationOnboardingTask.objects.get(
                    organization=self.organization,
                    task=OnboardingTask.SOURCEMAPS,
                    status=OnboardingTaskStatus.COMPLETE,
                )
                is not None
            )
            record_analytics.call_args_list[
                len(record_analytics.call_args_list) - 2
            ].assert_called_with(
                "first_sourcemaps.sent",
                user_id=self.user.id,
                organization_id=self.organization.id,
                project_id=project.id,
                platform=event_with_sourcemap.platform,
                project_platform=project.platform,
                url=dict(event_with_sourcemap.tags).get("url", None),
            )
            record_analytics.assert_called_with(
                "first_sourcemaps_for_project.sent",
                user_id=self.user.id,
                organization_id=self.organization.id,
                project_id=project.id,
                platform=event_with_sourcemap.platform,
                project_platform=project.platform,
                url=dict(event_with_sourcemap.tags).get("url", None),
            )

            # Onboarding is NOW complete
            assert (
                OrganizationOption.objects.filter(
                    organization=self.organization, key="onboarding:complete"
                ).count()
                == 1
            )
