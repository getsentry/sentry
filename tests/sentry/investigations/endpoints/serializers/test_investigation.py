from __future__ import annotations

from typing import Any

from django.db import connection
from django.test.utils import CaptureQueriesContext

from sentry.api.serializers import serialize
from sentry.investigations.endpoints.serializers import (
    InvestigationDetailsSerializer,
    InvestigationDetailsSerializerResponse,
    InvestigationSerializer,
)
from sentry.investigations.models import Investigation, InvestigationBlockExecutionStatus
from sentry.testutils.cases import TestCase


class InvestigationSerializerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Latency spike"
        )

    def test_serializes_the_list_representation(self) -> None:
        result = serialize(self.investigation, self.user, InvestigationSerializer())

        assert result == {
            "id": str(self.investigation.id),
            "title": "Latency spike",
            "summary": None,
            "summaryDescription": None,
            "status": self.investigation.status,
            "sourceType": "manual",
            "createdBy": str(self.user.id),
            "dateCreated": self.investigation.date_added,
            "dateUpdated": self.investigation.date_updated,
            "version": 1,
            "blockCount": 0,
            "isFavorited": False,
            "titleGeneration": {"status": None},
        }

    def test_counts_only_active_blocks(self) -> None:
        self.create_investigation_block(investigation=self.investigation, position=0)
        deleted = self.create_investigation_block(investigation=self.investigation, position=1)
        deleted.update(deleted_at=self.investigation.date_added)

        result = serialize(self.investigation, self.user, InvestigationSerializer())

        assert result["blockCount"] == 1

    def test_reports_the_viewers_own_favorite(self) -> None:
        other_user = self.create_user()
        self.create_investigation_favorite(investigation=self.investigation, user=other_user)

        assert not serialize(self.investigation, self.user, InvestigationSerializer())[
            "isFavorited"
        ]
        assert serialize(self.investigation, other_user, InvestigationSerializer())["isFavorited"]

    def test_is_registered_for_bare_serialize_calls(self) -> None:
        assert serialize(self.investigation, self.user) == serialize(
            self.investigation, self.user, InvestigationSerializer()
        )

    def test_query_count_does_not_grow_with_the_number_of_investigations(self) -> None:
        for index in range(3):
            investigation = self.create_investigation(
                organization=self.organization, title=f"First {index}"
            )
            self.create_investigation_block(investigation=investigation, position=0)
            self.create_investigation_favorite(investigation=investigation, user=self.user)

        first_batch = list(Investigation.objects.filter(organization=self.organization))
        serialize(
            first_batch,
            self.user,
            InvestigationSerializer(accessible_project_ids={self.project.id}),
        )
        with CaptureQueriesContext(connection) as first_queries:
            serialize(
                first_batch,
                self.user,
                InvestigationSerializer(accessible_project_ids={self.project.id}),
            )

        for index in range(3, 12):
            investigation = self.create_investigation(
                organization=self.organization, title=f"Second {index}"
            )
            self.create_investigation_block(investigation=investigation, position=0)
            self.create_investigation_favorite(investigation=investigation, user=self.user)

        second_batch = list(Investigation.objects.filter(organization=self.organization))
        with CaptureQueriesContext(connection) as second_queries:
            results = serialize(
                second_batch,
                self.user,
                InvestigationSerializer(accessible_project_ids={self.project.id}),
            )

        assert len(second_batch) > len(first_batch)
        assert len(second_queries.captured_queries) == len(first_queries.captured_queries)
        counts = sorted(result["blockCount"] for result in results)
        # Only the setUp investigation has no blocks; every created one has exactly one.
        assert counts == [0] + [1] * (len(second_batch) - 1)


class InvestigationDetailsSerializerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.investigation = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Investigation"
        )
        self.create_investigation_project(investigation=self.investigation, project=self.project)
        self.parameter = self.create_investigation_parameter(
            investigation=self.investigation,
            key="environment",
            label="Environment",
            type="string",
            position=0,
        )
        self.block = self.create_investigation_block(investigation=self.investigation, position=0)

    def serialize_detail(
        self, accessible_project_ids: set[int] | None = None
    ) -> InvestigationDetailsSerializerResponse:
        return serialize(
            self.investigation,
            self.user,
            InvestigationDetailsSerializer(
                accessible_project_ids=(
                    {self.project.id} if accessible_project_ids is None else accessible_project_ids
                )
            ),
        )

    def test_extends_the_list_representation(self) -> None:
        listed = serialize(self.investigation, self.user, InvestigationSerializer())
        detail = self.serialize_detail()

        # cast to a plain dict: a TypedDict cannot be indexed by a variable key
        detail_items: dict[str, Any] = dict(detail)
        assert set(listed) < set(detail_items)
        for key, value in listed.items():
            assert detail_items[key] == value

    def test_serializes_nested_collections(self) -> None:
        self.investigation.update(
            summary="Errors crossed alert threshold",
            summary_description="Checkout failures increased.\nRoll back the latest release.",
        )
        detail = self.serialize_detail()

        assert detail["summary"] == "Errors crossed alert threshold"
        assert detail["summaryDescription"] == (
            "Checkout failures increased.\nRoll back the latest release."
        )
        assert detail["projectIds"] == [self.project.id]
        assert [parameter["key"] for parameter in detail["parameters"]] == ["environment"]
        assert [block["id"] for block in detail["blocks"]] == [str(self.block.id)]

    def test_orders_blocks_by_position(self) -> None:
        second = self.create_investigation_block(investigation=self.investigation, position=1)
        third = self.create_investigation_block(investigation=self.investigation, position=2)

        detail = self.serialize_detail()

        assert [block["id"] for block in detail["blocks"]] == [
            str(self.block.id),
            str(second.id),
            str(third.id),
        ]

    def test_omits_soft_deleted_blocks(self) -> None:
        deleted = self.create_investigation_block(investigation=self.investigation, position=1)
        deleted.update(deleted_at=self.investigation.date_added)

        detail = self.serialize_detail()

        assert [block["id"] for block in detail["blocks"]] == [str(self.block.id)]

    def test_reports_no_template_for_a_manual_investigation(self) -> None:
        detail = self.serialize_detail()

        assert detail["template"] is None
        assert detail["source"]["type"] == "manual"
        assert detail["titleGeneration"] == {"status": None}

    def test_reports_the_template_that_created_the_investigation(self) -> None:
        self.investigation.update(template_key="breached_metric", template_version=1)

        detail = self.serialize_detail()

        assert detail["template"] == {"key": "breached_metric", "version": 1}

    def test_forwards_accessible_projects_to_blocks(self) -> None:
        execution = self.create_investigation_block_execution(
            block=self.block,
            executor="manual",
            block_version=1,
            input_fingerprint="f" * 64,
            status=InvestigationBlockExecutionStatus.COMPLETED,
            result={"schemaVersion": 1},
        )
        self.create_investigation_block_execution_project(execution=execution, project=self.project)
        self.block.update(current_execution=execution, result_execution=execution)

        assert self.serialize_detail()["blocks"][0]["outputStatus"] == "available"
        assert (
            self.serialize_detail(accessible_project_ids=set())["blocks"][0]["outputStatus"]
            == "restricted"
        )

    def test_query_count_is_constant_for_a_bare_queryset(self) -> None:
        def build(index: int) -> Investigation:
            investigation = self.create_investigation(
                organization=self.organization, title=f"Extra {index}"
            )
            self.create_investigation_project(investigation=investigation, project=self.project)
            parameter = self.create_investigation_parameter(
                investigation=investigation, key="env", label="Env", type="string", position=0
            )
            block = self.create_investigation_block(investigation=investigation, position=0)
            self.create_investigation_block_parameter(block=block, parameter=parameter)
            execution = self.create_investigation_block_execution(
                block=block,
                executor="manual",
                block_version=1,
                input_fingerprint="f" * 64,
                status=InvestigationBlockExecutionStatus.COMPLETED,
                result={"schemaVersion": 1},
            )
            self.create_investigation_block_execution_project(
                execution=execution, project=self.project
            )
            block.update(
                current_execution=execution,
                content_execution=execution,
                result_execution=execution,
            )
            return investigation

        serializer = InvestigationDetailsSerializer(accessible_project_ids={self.project.id})
        first = [build(0)]

        with CaptureQueriesContext(connection) as one:
            serialize(first, self.user, serializer)

        many_investigations = first + [build(index) for index in range(1, 5)]

        with CaptureQueriesContext(connection) as many:
            results = serialize(many_investigations, self.user, serializer)

        assert len(results) == 5
        assert len(many.captured_queries) == len(one.captured_queries)
