from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone

from sentry import onboarding_tasks
from sentry.analytics import record
from sentry.analytics.events.alert_created import AlertCreatedEvent
from sentry.analytics.events.first_event_sent import (
    FirstEventSentEvent,
    FirstEventSentEventWithMinifiedStackTraceForProject,
    FirstEventSentForProjectEvent,
)
from sentry.analytics.events.first_release_tag_sent import FirstReleaseTagSentEvent
from sentry.analytics.events.first_replay_sent import FirstReplaySentEvent
from sentry.analytics.events.first_sourcemaps_sent import (
    FirstSourcemapsSentEvent,
    FirstSourcemapsSentEventForProject,
)
from sentry.analytics.events.first_transaction_sent import FirstTransactionSentEvent
from sentry.analytics.events.member_invited import MemberInvitedEvent
from sentry.analytics.events.onboarding_complete import OnboardingCompleteEvent
from sentry.analytics.events.project_created import ProjectCreatedEvent
from sentry.analytics.events.project_transferred import ProjectTransferredEvent
from sentry.grouping.grouptype import ErrorGroupType
from sentry.integrations.analytics import IntegrationAddedEvent
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organizationonboardingtask import (
    OnboardingTask,
    OnboardingTaskStatus,
    OrganizationOnboardingTask,
)
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.receivers.rules import DEFAULT_RULE_LABEL
from sentry.signals import (
    alert_rule_created,
    event_processed,
    first_event_received,
    first_replay_received,
    first_transaction_received,
    integration_added,
    member_invited,
    member_joined,
    project_created,
    project_transferred,
    transaction_processed,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import (
    assert_any_analytics_event,
    assert_last_analytics_event,
    get_event_count,
)
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.utils.event import has_event_minified_stack_trace
from sentry.utils.samples import load_data
from sentry.workflow_engine.models import Workflow
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.models.detector_workflow import DetectorWorkflow
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType

pytestmark = [requires_snuba]


class OrganizationOnboardingTaskTest(TestCase):
    @assume_test_silo_mode(SiloMode.CONTROL)
    def _create_integration(self, provider: str, external_id: int = 9999):
        return self.create_provider_integration(
            provider=provider,
            name="test",
            external_id=external_id,
        )

    def test_existing_complete_task(self) -> None:
        now = timezone.now()
        project = self.create_project(first_event=now)
        task = OrganizationOnboardingTask.objects.create(
            organization=project.organization,
            task=OnboardingTask.FIRST_PROJECT,
            status=OnboardingTaskStatus.COMPLETE,
        )

        event = self.store_event(data={}, project_id=project.id)
        first_event_received.send(project=project, event=event, sender=None)

        task = OrganizationOnboardingTask.objects.get(id=task.id)
        assert task.status == OnboardingTaskStatus.COMPLETE
        assert not task.project_id

    # Tests on the receivers
    def test_event_processed(self) -> None:
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

        event_processed.send(project=project, event=event, sender=None)

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.RELEASE_TRACKING,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.SOURCEMAPS,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

    def test_project_created(self) -> None:
        now = timezone.now()
        project = self.create_project(first_event=now)
        project_created.send(project=project, user=self.user, sender=None)

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.FIRST_PROJECT,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None
        second_project = self.create_project(first_event=now)
        project_created.send(project=second_project, user=self.user, sender=None)

        second_project.delete()
        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.FIRST_PROJECT,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

    def test_project_created__default_workflow(self) -> None:
        project = self.create_project(fire_project_created=True)

        assert Rule.objects.filter(project=project).exists()
        workflow = Workflow.objects.get(organization=project.organization, name=DEFAULT_RULE_LABEL)

        assert Detector.objects.filter(project=project, type=ErrorGroupType.slug).count() == 1
        assert Detector.objects.filter(project=project, type=IssueStreamGroupType.slug).count() == 1
        assert DetectorWorkflow.objects.filter(workflow=workflow).count() == 2

    @patch("sentry.analytics.record", wraps=record)
    def test_project_created_with_origin(self, record_analytics: MagicMock) -> None:
        project = self.create_project()
        project_created.send(
            project=project, user=self.user, default_rules=False, sender=None, origin="ui"
        )

        task = OrganizationOnboardingTask.objects.get(
            organization=self.organization,
            task=OnboardingTask.FIRST_PROJECT,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

        # Verify origin is passed to analytics event
        assert_last_analytics_event(
            record_analytics,
            ProjectCreatedEvent(
                user_id=self.user.id,
                default_user_id=self.organization.default_owner_id,
                organization_id=self.organization.id,
                project_id=project.id,
                platform=project.platform,
                origin="ui",
            ),
        )

    @patch("sentry.analytics.record", wraps=record)
    def test_first_event_received(self, record_analytics: MagicMock) -> None:
        now = timezone.now()

        # Create first project and send event
        project = self.create_project(first_event=now, platform="javascript")
        project_created.send_robust(project=project, user=self.user, sender=None)
        event = self.store_event(
            data={"platform": "javascript", "message": "javascript error message"},
            project_id=project.id,
        )
        first_event_received.send_robust(project=project, event=event, sender=None)

        # Assert first event onboarding task is created and completed
        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.FIRST_EVENT,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None
        assert task.project_id == project.id

        # Ensure analytics events are called in the right order
        assert len(record_analytics.call_args_list) >= 2  # Ensure at least two calls
        assert_any_analytics_event(
            record_analytics,
            FirstEventSentForProjectEvent(
                user_id=self.user.id,
                organization_id=project.organization_id,
                project_id=project.id,
                platform=event.platform,
                project_platform=project.platform,
                url=dict(event.tags).get("url", None),
                has_minified_stack_trace=has_event_minified_stack_trace(event),
                sdk_name=None,
            ),
        )

        assert_any_analytics_event(
            record_analytics,
            FirstEventSentEvent(
                user_id=self.user.id,
                organization_id=project.organization_id,
                project_id=project.id,
                platform=event.platform,
                project_platform=project.platform,
            ),
        )
        # Create second project and send event
        second_project = self.create_project(first_event=now, platform="python")
        project_created.send(project=second_project, user=self.user, sender=None)

        # Assert second platform onboarding task is completed
        second_task = OrganizationOnboardingTask.objects.get(
            organization=second_project.organization,
            task=OnboardingTask.SECOND_PLATFORM,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert second_task is not None

        # An event is sent for the second project
        first_event_received.send_robust(project=second_project, event=event, sender=None)

        # Ensure first project's onboarding task remains unchanged
        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.FIRST_EVENT,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task.project_id == project.id

        # Ensure "first_event_for_project.sent" was called again for second project
        record_analytics.call_args_list[-1].assert_called_with(
            FirstEventSentForProjectEvent(
                user_id=self.user.id,
                organization_id=second_project.organization_id,
                project_id=second_project.id,
                platform=event.platform,
                project_platform=second_project.platform,
                url=dict(event.tags).get("url", None),
                has_minified_stack_trace=has_event_minified_stack_trace(event),
                sdk_name=None,
            )
        )
        # Ensure "first_event.sent" was called exactly once
        assert get_event_count(record_analytics, FirstEventSentEvent, exact=True) == 1

    def test_first_transaction_received(self) -> None:
        project = self.create_project()

        event_data = load_data("transaction")
        min_ago = before_now(minutes=1).isoformat()
        event_data.update({"start_timestamp": min_ago, "timestamp": min_ago})

        event = self.store_event(data=event_data, project_id=project.id)

        first_event_received.send(project=project, event=event, sender=None)
        first_transaction_received.send(project=project, event=event, sender=None)

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.FIRST_TRANSACTION,
            status=OnboardingTaskStatus.COMPLETE,
        )

        assert task is not None

    def test_member_invited(self) -> None:
        user = self.create_user(email="test@example.org")
        member = self.create_member(
            organization=self.organization, teams=[self.team], email=user.email
        )
        member_invited.send(member=member, user=user, sender=None)

        task = OrganizationOnboardingTask.objects.get(
            organization=self.organization,
            task=OnboardingTask.INVITE_MEMBER,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

    def test_alert_added(self) -> None:
        alert_rule_created.send(
            rule_id=Rule(id=1).id,
            project=self.project,
            user=self.user,
            rule_type="issue",
            sender=None,
            is_api_token=False,
        )
        task = OrganizationOnboardingTask.objects.get(
            organization=self.organization,
            task=OnboardingTask.ALERT_RULE,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

    def test_integration_added(self) -> None:
        integration_added.send(
            integration_id=self._create_integration("slack", 1234).id,
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

        # Adding a second integration
        integration_added.send(
            integration_id=self._create_integration("github", 4567).id,
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

    @patch("sentry.analytics.record", wraps=record)
    def test_first_event_without_minified_stack_trace_received(
        self, record_analytics: MagicMock
    ) -> None:
        """
        Test that an analytics event is NOT recorded when
        there no event with minified stack trace is received
        """
        now = timezone.now()
        project = self.create_project(first_event=now)
        project_created.send(project=project, user=self.user, sender=None)
        data = load_data("javascript")
        self.store_event(
            data=data,
            project_id=project.id,
        )

        with pytest.raises(AssertionError):
            assert_last_analytics_event(
                record_analytics,
                FirstEventSentEventWithMinifiedStackTraceForProject(
                    user_id=self.user.id,
                    organization_id=project.organization_id,
                    project_id=project.id,
                    platform="javascript",
                    url="http://localhost:3000",
                ),
            )

    @patch("sentry.analytics.record", wraps=record)
    def test_first_event_with_minified_stack_trace_received(
        self, record_analytics: MagicMock
    ) -> None:
        """
        Test that an analytics event is recorded when
        a first event with minified stack trace is received
        """
        now = timezone.now()
        project = self.create_project(first_event=now, platform="VueJS")
        project_created.send(project=project, user=self.user, sender=None)
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

        assert_last_analytics_event(
            record_analytics,
            FirstEventSentEventWithMinifiedStackTraceForProject(
                user_id=self.user.id,
                organization_id=project.organization_id,
                project_id=project.id,
                platform=event["platform"],
                project_platform="VueJS",
                url=url,
            ),
        )

    @patch("sentry.analytics.record", wraps=record)
    def test_analytic_triggered_only_once_if_multiple_events_with_minified_stack_trace_received(
        self, record_analytics
    ):
        """
        Test that an analytic event is triggered only once when
        multiple events with minified stack trace are received
        """
        now = timezone.now()
        project = self.create_project(first_event=now)
        project_created.send(project=project, user=self.user, sender=None)
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

        assert (
            get_event_count(record_analytics, FirstEventSentEventWithMinifiedStackTraceForProject)
            == 1
        )

    @patch("sentry.analytics.record", wraps=record)
    def test_old_project_sending_minified_stack_trace_event(
        self, record_analytics: MagicMock
    ) -> None:
        """
        Test that an analytics event is NOT recorded when
        the project creation date is older than the date we defined (START_DATE_TRACKING_FIRST_EVENT_WITH_MINIFIED_STACK_TRACE_PER_PROJ).

        In this test we also check  if the has_minified_stack_trace is being set to "True" in old projects
        """
        old_date = datetime(2022, 12, 10, tzinfo=UTC)
        project = self.create_project(first_event=old_date, date_added=old_date)
        project_created.send(project=project, user=self.user, sender=None)
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
        assert (
            get_event_count(record_analytics, FirstEventSentEventWithMinifiedStackTraceForProject)
            == 0
        )

    @patch("sentry.analytics.record", wraps=record)
    def test_first_event_without_sourcemaps_received(self, record_analytics: MagicMock) -> None:
        """
        Test that an analytics event is NOT recorded when
        no event with sourcemaps is received
        """
        now = timezone.now()
        project = self.create_project(first_event=now)
        project_created.send(project=project, user=self.user, sender=None)
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

        event_processed.send(project=project, event=event, sender=None)

        assert get_event_count(record_analytics, FirstSourcemapsSentEventForProject) == 0

    @patch("sentry.analytics.record", wraps=record)
    def test_first_event_with_sourcemaps_received(self, record_analytics: MagicMock) -> None:
        """
        Test that an analytics event is recorded when
        a first event with sourcemaps is received
        """
        now = timezone.now()
        project = self.create_project(first_event=now, platform="VueJS")
        project_created.send(project=project, user=self.user, sender=None)
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
        event_processed.send(project=project, event=event, sender=None)

        assert_last_analytics_event(
            record_analytics,
            FirstSourcemapsSentEventForProject(
                user_id=self.user.id,
                organization_id=project.organization_id,
                project_id=project.id,
                platform=event.platform,
                project_platform="VueJS",
                url=url,
            ),
        )

    @patch("sentry.analytics.record", wraps=record)
    def test_analytic_triggered_only_once_if_multiple_events_with_sourcemaps_received(
        self, record_analytics
    ):
        """
        Test that an analytic event is triggered only once when
        multiple events with sourcemaps are received
        """
        now = timezone.now()
        project = self.create_project(first_event=now)
        project_created.send(project=project, user=self.user, sender=None)
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
        event_processed.send(project=project, event=event_1, sender=None)

        # Store second event
        event_2 = self.store_event(
            project_id=project.id,
            data=data,
        )
        event_processed.send(project=project, event=event_2, sender=None)

        assert get_event_count(record_analytics, FirstSourcemapsSentEventForProject) == 1

    @patch("sentry.analytics.record", wraps=record)
    def test_old_project_sending_sourcemap_event(self, record_analytics: MagicMock) -> None:
        """
        Test that an analytics event is NOT recorded when
        the project creation date is older than the date we defined (START_DATE_TRACKING_FIRST_EVENT_WITH_SOURCEMAPS_PER_PROJ).

        In this test we also check  if the has_sourcemaps is being set to "True" in old projects
        """
        old_date = datetime(2022, 12, 10, tzinfo=UTC)
        project = self.create_project(first_event=old_date, date_added=old_date)
        project_created.send(project=project, user=self.user, sender=None)
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
        event_processed.send(project=project, event=event, sender=None)

        project.refresh_from_db()

        assert _project_has_sourcemaps(project)

        # The analytic's event "first_event_with_minified_stack_trace_for_project" shall not be sent
        assert get_event_count(record_analytics, FirstSourcemapsSentEventForProject) == 0

    @patch("sentry.analytics.record", wraps=record)
    def test_real_time_notifications_added(self, record_analytics: MagicMock) -> None:
        integration_id = self._create_integration("slack", 123).id
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

        assert_last_analytics_event(
            record_analytics,
            IntegrationAddedEvent(
                user_id=self.user.id,
                default_user_id=self.organization.default_owner_id,
                organization_id=self.organization.id,
                id=integration_id,
                provider="slack",
            ),
        )

    @patch("sentry.analytics.record", wraps=record)
    def test_source_code_management_added(self, record_analytics: MagicMock) -> None:
        integration_id = self._create_integration("github", 123).id
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

        assert_last_analytics_event(
            record_analytics,
            IntegrationAddedEvent(
                user_id=self.user.id,
                default_user_id=self.organization.default_owner_id,
                organization_id=self.organization.id,
                id=integration_id,
                provider="github",
            ),
        )

    def test_second_platform_complete(self) -> None:
        now = timezone.now()
        project = self.create_project(first_event=now)
        second_project = self.create_project(first_event=now)

        project_created.send(project=project, user=self.user, sender=None)
        project_created.send(project=second_project, user=self.user, sender=None)

        task = OrganizationOnboardingTask.objects.get(
            organization=self.organization,
            task=OnboardingTask.SECOND_PLATFORM,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

    def test_release_received_through_transaction_event(self) -> None:
        project = self.create_project()

        event_data = load_data("transaction")
        event_data.update({"release": "my-first-release", "tags": []})

        event = self.store_event(data=event_data, project_id=project.id)
        event_processed.send(project=project, event=event, sender=None)

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.RELEASE_TRACKING,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

    def test_issue_alert_received_through_project_creation(self) -> None:
        now = timezone.now()

        first_organization = self.create_organization(owner=self.user, slug="first-org")
        first_project = self.create_project(first_event=now, organization=first_organization)
        # By default, the project creation will create a default rule
        project_created.send(project=first_project, user=self.user, sender=None)
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
            sender=None,
            default_rules=False,
        )
        assert not OrganizationOnboardingTask.objects.filter(
            organization=second_project.organization,
            task=OnboardingTask.ALERT_RULE,
            status=OnboardingTaskStatus.COMPLETE,
        ).exists()

    @patch("sentry.analytics.record", wraps=record)
    def test_new_onboarding_complete(self, record_analytics: MagicMock) -> None:
        """
        Test the new quick start happy path (without source maps)
        """
        # Create first project
        project = self.create_project(platform="python")
        project_created.send(project=project, user=self.user, default_rules=False, sender=None)
        assert (
            OrganizationOnboardingTask.objects.get(
                organization=self.organization,
                task=OnboardingTask.FIRST_PROJECT,
                status=OnboardingTaskStatus.COMPLETE,
            )
            is not None
        )
        assert_last_analytics_event(
            record_analytics,
            ProjectCreatedEvent(
                user_id=self.user.id,
                default_user_id=self.organization.default_owner_id,
                organization_id=self.organization.id,
                project_id=project.id,
                platform=project.platform,
                origin=None,
            ),
        )

        # Set up tracing
        transaction_event = load_data("transaction")
        transaction_event.update({"user": None})
        event = self.store_event(data=transaction_event, project_id=project.id)
        transaction_processed.send(project=project, event=event, sender=None)
        assert (
            OrganizationOnboardingTask.objects.get(
                organization=self.organization,
                task=OnboardingTask.FIRST_TRANSACTION,
                status=OnboardingTaskStatus.COMPLETE,
            )
            is not None
        )
        assert_last_analytics_event(
            record_analytics,
            FirstTransactionSentEvent(
                default_user_id=self.organization.default_owner_id,
                organization_id=self.organization.id,
                project_id=project.id,
                platform=project.platform,
            ),
        )
        #  Capture first error
        error_event = self.store_event(
            data={
                "event_id": "c" * 32,
                "message": "this is bad.",
                "timestamp": timezone.now().isoformat(),
                "type": "error",
            },
            project_id=project.id,
        )
        event_processed.send(project=project, event=error_event, sender=None)
        assert (
            OrganizationOnboardingTask.objects.get(
                organization=self.organization,
                task=OnboardingTask.FIRST_EVENT,
                status=OnboardingTaskStatus.COMPLETE,
            )
            is not None
        )
        assert_last_analytics_event(
            record_analytics,
            FirstEventSentEvent(
                user_id=self.user.id,
                organization_id=project.organization_id,
                project_id=project.id,
                platform=error_event.platform,
                project_platform=project.platform,
            ),
        )

        # Configure an issue alert
        alert_rule_created.send(
            rule_id=Rule(id=1).id,
            project=project,
            user=self.user,
            rule_type="issue",
            sender=None,
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
        assert_last_analytics_event(
            record_analytics,
            AlertCreatedEvent(
                user_id=self.user.id,
                default_user_id=self.organization.default_owner_id,
                organization_id=self.organization.id,
                project_id=project.id,
                rule_id=Rule(id=1).id,
                rule_type="issue",
                is_api_token=False,
                referrer=None,
                session_id=None,
                alert_rule_ui_component=None,
                duplicate_rule=None,
                wizard_v3=None,
                query_type=None,
            ),
        )

        # Track releases
        transaction_event = load_data("transaction")
        transaction_event.update({"release": "my-first-release", "tags": []})
        event = self.store_event(data=transaction_event, project_id=project.id)
        transaction_processed.send(project=project, event=event, sender=None)
        assert (
            OrganizationOnboardingTask.objects.get(
                organization=self.organization,
                task=OnboardingTask.RELEASE_TRACKING,
                status=OnboardingTaskStatus.COMPLETE,
            )
            is not None
        )

        assert_any_analytics_event(
            record_analytics,
            FirstReleaseTagSentEvent(
                user_id=self.user.id,
                project_id=project.id,
                organization_id=self.organization.id,
            ),
        )

        # Link Sentry to source code
        github_integration = self._create_integration("github", 1234)
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
        assert_last_analytics_event(
            record_analytics,
            IntegrationAddedEvent(
                user_id=self.user.id,
                default_user_id=self.organization.default_owner_id,
                organization_id=self.organization.id,
                provider=github_integration.provider,
                id=github_integration.id,
            ),
        )

        # Invite your team
        user = self.create_user(email="test@example.org")
        member = self.create_member(
            organization=self.organization, teams=[self.team], email=user.email
        )
        member_invited.send(member=member, user=user, sender=None)
        assert (
            OrganizationOnboardingTask.objects.get(
                organization=self.organization,
                task=OnboardingTask.INVITE_MEMBER,
                status=OnboardingTaskStatus.COMPLETE,
            )
            is not None
        )
        assert_last_analytics_event(
            record_analytics,
            MemberInvitedEvent(
                invited_member_id=member.id,
                inviter_user_id=user.id,
                organization_id=self.organization.id,
                referrer=None,
            ),
        )

        # Manually update the completionSeen column of existing tasks
        OrganizationOnboardingTask.objects.filter(organization=self.organization).update(
            completion_seen=timezone.now()
        )
        onboarding_tasks.try_mark_onboarding_complete(self.organization.id)

        # The first group is complete but the beyond the basics is not
        assert (
            OrganizationOption.objects.filter(
                organization=self.organization, key="onboarding:complete"
            ).count()
            == 0
        )

        # Set up session replay
        first_replay_received.send(project=project, sender=None)
        assert (
            OrganizationOnboardingTask.objects.get(
                organization=self.organization,
                task=OnboardingTask.SESSION_REPLAY,
                status=OnboardingTaskStatus.COMPLETE,
            )
            is not None
        )
        assert_last_analytics_event(
            record_analytics,
            FirstReplaySentEvent(
                user_id=self.user.id,
                organization_id=project.organization_id,
                project_id=project.id,
                platform=project.platform,
            ),
        )  # Get real time notifications
        slack_integration = self._create_integration("slack", 4321)
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
        assert_last_analytics_event(
            record_analytics,
            IntegrationAddedEvent(
                user_id=self.user.id,
                default_user_id=self.organization.default_owner_id,
                organization_id=self.organization.id,
                provider=slack_integration.provider,
                id=slack_integration.id,
            ),
        )
        # Add Sentry to other parts app
        second_project = self.create_project(
            first_event=timezone.now(), organization=self.organization
        )
        project_created.send(
            project=second_project,
            user=self.user,
            sender=None,
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

        # Manually update the completionSeen column of existing tasks
        OrganizationOnboardingTask.objects.filter(organization=self.organization).update(
            completion_seen=timezone.now()
        )
        onboarding_tasks.try_mark_onboarding_complete(self.organization.id)

        # Onboarding is complete
        assert (
            OrganizationOption.objects.filter(
                organization=self.organization, key="onboarding:complete"
            ).count()
            == 1
        )
        assert_last_analytics_event(
            record_analytics,
            OnboardingCompleteEvent(
                user_id=self.user.id,
                organization_id=self.organization.id,
                referrer="onboarding_tasks",
            ),
        )

    @patch("sentry.analytics.record", wraps=record)
    def test_source_maps_as_required_task(self, record_analytics: MagicMock) -> None:
        """
        Test the new quick start happy path (with source maps)
        """
        # Create a project that can have source maps + create an issue alert
        project = self.create_project(platform="javascript")
        project_created.send(project=project, user=self.user, sender=None)

        # Capture first transaction + release
        transaction_event = load_data("transaction")
        transaction_event.update({"release": "my-first-release", "tags": []})
        event = self.store_event(data=transaction_event, project_id=project.id)
        transaction_processed.send(project=project, event=event, sender=None)

        #  Capture first error
        error_event = self.store_event(
            data={
                "event_id": "c" * 32,
                "message": "this is bad.",
                "timestamp": timezone.now().isoformat(),
                "type": "error",
                "release": "my-first-release",
            },
            project_id=project.id,
        )
        event_processed.send(project=project, event=error_event, sender=None)

        # Invite your team
        user = self.create_user(email="test@example.org")
        member = self.create_member(
            organization=self.organization, teams=[self.team], email=user.email
        )
        member_invited.send(member=member, user=user, sender=None)

        # Member accepted the invite
        member_joined.send(
            organization_member_id=member.id,
            organization_id=self.organization.id,
            user_id=user.id,
            sender=None,
        )

        # Link Sentry to source code
        github_integration = self._create_integration("github", 1234)
        integration_added.send(
            integration_id=github_integration.id,
            organization_id=self.organization.id,
            user_id=self.user.id,
            sender=None,
        )

        # Set up session replay
        first_replay_received.send(project=project, sender=None)

        # Get real time notifications
        slack_integration = self._create_integration("slack", 4321)
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
            sender=None,
            default_rules=False,
        )

        # Manually update the completionSeen column of existing tasks
        OrganizationOnboardingTask.objects.filter(organization=self.organization).update(
            completion_seen=timezone.now()
        )
        onboarding_tasks.try_mark_onboarding_complete(self.organization.id)

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
        event_processed.send(project=project, event=event_with_sourcemap, sender=None)
        assert (
            OrganizationOnboardingTask.objects.get(
                organization=self.organization,
                task=OnboardingTask.SOURCEMAPS,
                status=OnboardingTaskStatus.COMPLETE,
            )
            is not None
        )
        assert_any_analytics_event(
            record_analytics,
            FirstSourcemapsSentEvent(
                user_id=self.user.id,
                organization_id=self.organization.id,
                project_id=project.id,
                platform=event_with_sourcemap.platform,
                project_platform=project.platform,
                url=dict(event_with_sourcemap.tags).get("url", None),
            ),
        )
        assert_last_analytics_event(
            record_analytics,
            FirstSourcemapsSentEventForProject(
                user_id=self.user.id,
                organization_id=self.organization.id,
                project_id=project.id,
                platform=event_with_sourcemap.platform,
                project_platform=project.platform,
                url=dict(event_with_sourcemap.tags).get("url", None),
            ),
        )

        # Manually update the completionSeen column of existing tasks
        OrganizationOnboardingTask.objects.filter(organization=self.organization).update(
            completion_seen=timezone.now()
        )
        onboarding_tasks.try_mark_onboarding_complete(self.organization.id)

        # Onboarding is NOW complete
        assert (
            OrganizationOption.objects.filter(
                organization=self.organization, key="onboarding:complete"
            ).count()
            == 1
        )

    @patch("sentry.analytics.record", wraps=record)
    def test_tasks_are_transferred_when_project_is_transferred(
        self, record_analytics: MagicMock
    ) -> None:
        """
        Test that onboarding tasks are transferred when a project is transferred
        """

        project = self.create_project(platform="python")
        project_created.send(project=project, user=self.user, default_rules=True, sender=None)

        transaction_event = load_data("transaction")
        transaction_event.update({"user": None, "release": "my-first-release", "tags": []})
        event = self.store_event(data=transaction_event, project_id=project.id)
        transaction_processed.send(project=project, event=event, sender=None)

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
        event_processed.send(project=project, event=event_with_sourcemap, sender=None)

        error_event = self.store_event(
            data={
                "event_id": "c" * 32,
                "message": "this is bad.",
                "timestamp": timezone.now().isoformat(),
                "type": "error",
            },
            project_id=project.id,
        )
        event_processed.send(project=project, event=error_event, sender=None)

        first_replay_received.send(project=project, sender=None)

        new_organization = self.create_organization(slug="new-org")

        project.organization = new_organization
        project_transferred.send(
            old_org_id=self.organization.id,
            project=project,
            sender=None,
        )

        assert_last_analytics_event(
            record_analytics,
            ProjectTransferredEvent(
                old_organization_id=self.organization.id,
                new_organization_id=new_organization.id,
                project_id=project.id,
                platform=project.platform,
            ),
        )
        project2 = self.create_project(platform="javascript-react")
        project_created.send(project=project2, user=self.user, default_rules=False, sender=None)
        project2.organization = new_organization
        project_transferred.send(
            old_org_id=self.organization.id,
            project=project2,
            sender=None,
        )

        assert_last_analytics_event(
            record_analytics,
            ProjectTransferredEvent(
                old_organization_id=self.organization.id,
                new_organization_id=new_organization.id,
                project_id=project2.id,
                platform=project2.platform,
            ),
        )

        transferred_tasks = OrganizationOnboardingTask.objects.filter(
            organization_id=new_organization.id,
            task__in=OrganizationOnboardingTask.TRANSFERABLE_TASKS,
        )

        self.assertEqual(len(transferred_tasks), len(OrganizationOnboardingTask.TRANSFERABLE_TASKS))
