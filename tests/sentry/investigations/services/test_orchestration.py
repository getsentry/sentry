from __future__ import annotations

from datetime import timedelta
from typing import Any
from unittest import mock

import pytest
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from sentry.constants import ObjectStatus
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.investigations.models import InvestigationOrchestrationRun
from sentry.investigations.services.investigations import (
    InvestigationValidationError,
    resolve_investigation_source,
)
from sentry.investigations.services.orchestration import (
    agentic_breached_metric_source_key,
    create_agentic_breached_metric_investigation,
    create_agentic_manual_investigation,
    rebuild_orchestration_source,
)
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.organization import Organization
from sentry.notebooks.models import Notebook, NotebookStatus
from sentry.service_accounts.models import ServiceAccountReplica
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import cell_silo_test
from sentry.viewer_context import ActorId, ActorType
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


class BreachedMetricInvestigationTestCase(TestCase):
    """Starts a breached-metric investigation on a static metric monitor."""

    def setUp(self) -> None:
        super().setUp()
        self.enterContext(self.feature("organizations:investigations"))
        group = self.create_group(project=self.project, type=MetricIssue.type_id)
        open_period = GroupOpenPeriod.objects.get(group=group, date_ended__isnull=True)
        ended_at = timezone.now() - timedelta(hours=1)
        open_period.update(date_started=ended_at - timedelta(hours=2), date_ended=ended_at)
        self.snuba_query = create_snuba_query(
            query_type=SnubaQuery.Type.ERROR,
            dataset=Dataset.Events,
            query="level:error",
            aggregate="count()",
            time_window=timedelta(minutes=5),
            resolution=timedelta(minutes=1),
            environment=None,
        )
        subscription = create_snuba_subscription(
            project=self.project, subscription_type="incidents", snuba_query=self.snuba_query
        )
        condition_group = self.create_data_condition_group(organization=self.organization)
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=500,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        self.detector = self.create_detector(
            project=self.project,
            type=MetricIssue.slug,
            config={"detection_type": "static"},
            workflow_condition_group=condition_group,
        )
        self.create_data_source_detector(
            data_source=self.create_data_source(
                organization=self.organization,
                source_id=str(subscription.id),
                type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
            ),
            detector=self.detector,
        )
        self.create_detector_group(detector=self.detector, group=group)
        self.group = group
        self.open_period = open_period
        self.investigation, _ = self.launch()

    def launch(self) -> tuple[Notebook, bool]:
        return create_agentic_breached_metric_investigation(
            organization=self.organization,
            creator=ActorId(ActorType.USER, self.user.id),
            title=None,
            resolved_source=resolve_investigation_source(
                organization=self.organization,
                source={
                    "type": "metric_open_period",
                    "ref": {
                        "groupId": str(self.group.id),
                        "openPeriodId": str(self.open_period.id),
                    },
                },
                accessible_project_ids={self.project.id},
            ),
            project_ids=[self.project.id],
            filters={},
        )

    def started_source(self, investigation: Notebook) -> dict[str, Any]:
        return InvestigationOrchestrationRun.objects.get(investigation=investigation).source


def test_source_key_is_the_readable_open_period_ref() -> None:
    assert (
        agentic_breached_metric_source_key(
            {"type": "metric_open_period", "ref": {"groupId": "12", "openPeriodId": "34"}}
        )
        == "metric_open_period:12:34"
    )
    assert (
        agentic_breached_metric_source_key(
            {"type": "metric_open_period", "ref": {"groupId": 12, "openPeriodId": 34}}
        )
        == "metric_open_period:12:34"
    )


class AgenticBreachedMetricInvestigationTest(BreachedMetricInvestigationTestCase):
    def test_stores_the_readable_source_key(self) -> None:
        assert (
            self.investigation.source_key
            == f"metric_open_period:{self.group.id}:{self.open_period.id}"
        )
        assert self.investigation.source_revision == 1

    def test_reuses_the_active_notebook_for_the_same_source(self) -> None:
        investigation, created = self.launch()

        assert not created
        assert investigation.id == self.investigation.id

    def test_starts_a_new_revision_once_the_active_one_is_archived(self) -> None:
        self.investigation.update(status=NotebookStatus.ARCHIVED)

        investigation, created = self.launch()

        assert created
        assert investigation.source_key == self.investigation.source_key
        assert investigation.source_revision == 2


class RebuildOrchestrationSourceTest(BreachedMetricInvestigationTestCase):
    def test_matches_the_source_the_run_started_with(self) -> None:
        assert rebuild_orchestration_source(self.investigation) == self.started_source(
            self.investigation
        )

    def test_reads_the_monitor_as_it_is_now(self) -> None:
        self.snuba_query.update(time_window=900)

        rebuilt = rebuild_orchestration_source(self.investigation)

        assert rebuilt is not None
        started = self.started_source(self.investigation)
        monitor = {**started["monitor"], "timeWindowSeconds": 900}
        assert rebuilt["monitor"] == monitor
        assert rebuilt["seed"]["sentrySource"]["snapshot"]["monitor"] == monitor
        unchanged = set(started) - {"monitor", "seed"}
        assert {key: rebuilt[key] for key in unchanged} == {key: started[key] for key in unchanged}

    def test_is_none_once_the_monitor_is_gone(self) -> None:
        Detector.objects.filter(id=self.detector.id).update(status=ObjectStatus.PENDING_DELETION)

        assert rebuild_orchestration_source(self.investigation) is None

    def test_a_manual_source_is_rebuilt_from_the_investigation(self) -> None:
        investigation, run = create_agentic_manual_investigation(
            organization=self.organization,
            creator=ActorId(ActorType.USER, self.user.id),
            title=None,
            source={"type": "manual", "prompt": "Investigate latency"},
            project_ids=[self.project.id],
            filters={},
        )

        assert rebuild_orchestration_source(investigation) == run.source


@cell_silo_test
class ServiceAccountCreationTest(BreachedMetricInvestigationTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization.flags.allow_joinleave = True
        self.organization.save()
        self.creator = self.account_creator(id=910001)

    def account_creator(self, organization: Organization | None = None, **kwargs: Any) -> ActorId:
        with outbox_runner():
            account = self.create_service_account(
                organization=organization or self.organization, **kwargs
            )
        return ActorId(ActorType.SERVICE_ACCOUNT, account.id)

    @mock.patch("sentry.tasks.seer.investigation.dispatch_investigation_orchestration_create.delay")
    def test_account_creation_is_rejected_before_dispatch(self, dispatch: mock.Mock) -> None:
        before = (Notebook.objects.count(), InvestigationOrchestrationRun.objects.count())
        with pytest.raises(PermissionDenied):
            create_agentic_manual_investigation(
                organization=self.organization,
                creator=self.creator,
                title=None,
                source={"type": "manual"},
                project_ids=[self.project.id],
                filters={},
            )
        assert (
            Notebook.objects.count(),
            InvestigationOrchestrationRun.objects.count(),
        ) == before
        dispatch.assert_not_called()

    @mock.patch("sentry.tasks.seer.investigation.dispatch_investigation_orchestration_create.delay")
    def test_metric_reuse_preserves_creator_and_checks_current_access(
        self, dispatch: mock.Mock
    ) -> None:
        assert self.creator.id is not None
        source = resolve_investigation_source(
            organization=self.organization,
            source={"type": "metric_open_period", "ref": self.investigation.source["ref"]},
            accessible_project_ids={self.project.id},
        )
        arguments: dict[str, Any] = dict(
            organization=self.organization,
            title=None,
            resolved_source=source,
            project_ids=[self.project.id],
            filters={},
        )
        with self.feature("organizations:investigations"):
            for creator in (ActorId(ActorType.USER, self.user.id), self.creator):
                with self.subTest(creator=creator), pytest.raises(InvestigationValidationError):
                    create_agentic_breached_metric_investigation(
                        creator=creator, **{**arguments, "project_ids": []}
                    )
            dispatch.assert_not_called()

            self.investigation.update(status=NotebookStatus.ARCHIVED)
            with pytest.raises(PermissionDenied):
                create_agentic_breached_metric_investigation(creator=self.creator, **arguments)
            assert not Notebook.objects.filter(status=NotebookStatus.ACTIVE).exists()
            dispatch.assert_not_called()

            # Existing account attribution remains valid while new account dispatch is blocked.
            investigation = self.investigation
            investigation.update(
                status=NotebookStatus.ACTIVE,
                created_by_id=None,
                created_by_service_account_id=self.creator.id,
            )
            assert investigation.creator_actor == self.creator

            reused, created = create_agentic_breached_metric_investigation(
                creator=self.creator, **arguments
            )
            assert not created
            assert reused.id == investigation.id

            reused, created = create_agentic_breached_metric_investigation(
                creator=ActorId(ActorType.USER, self.user.id), **arguments
            )
            assert not created
            assert reused.id == investigation.id
            assert reused.creator_actor == self.creator
            ServiceAccountReplica.objects.filter(service_account_id=self.creator.id).update(
                is_active=False
            )
            with pytest.raises(PermissionDenied):
                create_agentic_breached_metric_investigation(creator=self.creator, **arguments)
            dispatch.assert_not_called()

    @mock.patch("sentry.tasks.seer.investigation.dispatch_investigation_orchestration_create.delay")
    def test_invalid_creators_and_access_have_no_side_effects(self, dispatch: mock.Mock) -> None:
        other_organization = self.create_organization()
        foreign_creator = self.account_creator(organization=other_organization)
        unprivileged_creator = self.account_creator(name="no-access", scope_list=["event:read"])
        inactive_project = self.create_project(
            organization=self.organization, status=ObjectStatus.PENDING_DELETION
        )
        inactive_user = self.create_user(is_active=False)
        self.create_member(organization=self.organization, user=inactive_user)
        arguments: dict[str, Any] = dict(
            organization=self.organization,
            creator=self.creator,
            title=None,
            resolved_source=resolve_investigation_source(
                organization=self.organization,
                source={"type": "metric_open_period", "ref": self.investigation.source["ref"]},
                accessible_project_ids={self.project.id},
            ),
            project_ids=[self.project.id],
            filters={},
        )
        cases: list[tuple[dict[str, Any], type[Exception]]] = [
            ({"creator": ActorId(ActorType.SYSTEM, None)}, InvestigationValidationError),
            ({"creator": ActorId(ActorType.USER, True)}, InvestigationValidationError),
            ({"creator": foreign_creator}, PermissionDenied),
            ({"creator": unprivileged_creator}, PermissionDenied),
            ({"creator": ActorId(ActorType.USER, self.create_user().id)}, PermissionDenied),
            ({"creator": ActorId(ActorType.USER, inactive_user.id)}, PermissionDenied),
            ({"project_ids": [inactive_project.id]}, InvestigationValidationError),
            (
                {
                    "creator": ActorId(ActorType.USER, self.user.id),
                    "project_ids": [inactive_project.id],
                },
                InvestigationValidationError,
            ),
        ]
        before = (Notebook.objects.count(), InvestigationOrchestrationRun.objects.count())
        with self.feature("organizations:investigations"):
            for overrides, error in cases:
                with self.subTest(overrides=overrides), pytest.raises(error):
                    create_agentic_breached_metric_investigation(**{**arguments, **overrides})
            assert (
                Notebook.objects.count(),
                InvestigationOrchestrationRun.objects.count(),
            ) == before
            dispatch.assert_not_called()

    @mock.patch("sentry.tasks.seer.investigation.dispatch_investigation_orchestration_create.delay")
    def test_both_creators_require_feature_and_open_membership(self, dispatch: mock.Mock) -> None:
        before = (Notebook.objects.count(), InvestigationOrchestrationRun.objects.count())
        source = resolve_investigation_source(
            organization=self.organization,
            source={"type": "metric_open_period", "ref": self.investigation.source["ref"]},
            accessible_project_ids={self.project.id},
        )
        for enabled, open_membership in ((False, True), (True, False)):
            self.organization.flags.allow_joinleave = open_membership
            self.organization.save()
            with self.feature({"organizations:investigations": enabled}):
                for creator in (ActorId(ActorType.USER, self.user.id), self.creator):
                    with (
                        self.subTest(creator=creator, enabled=enabled),
                        pytest.raises(PermissionDenied),
                    ):
                        create_agentic_breached_metric_investigation(
                            organization=self.organization,
                            creator=creator,
                            title=None,
                            resolved_source=source,
                            project_ids=[self.project.id],
                            filters={},
                        )
        assert (
            Notebook.objects.count(),
            InvestigationOrchestrationRun.objects.count(),
        ) == before
        dispatch.assert_not_called()
