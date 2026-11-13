from datetime import UTC, timedelta
from unittest.mock import patch

import pytest
from django.http import Http404
from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageConfig
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    TraceItemColumnValues,
    TraceItemTableResponse,
)
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue, IntArray
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter

from sentry.constants import ObjectStatus
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import cell_silo_test
from sentry.workflow_engine.artifacts import (
    CONFIGURATION_ITEM_LIMIT,
    RELATED_ITEM_LIMIT,
    ArtifactContext,
    _context_value,
    query_artifacts,
    resolve_artifact_context,
)
from sentry.workflow_engine.models import Action, DataConditionGroup, Detector, Workflow
from sentry.workflow_engine.models.data_condition import Condition

NOW = before_now(minutes=1).replace(microsecond=0)
EVENT_ID = "1234567890abcdef1234567890abcdef"


def table_response(rows: list[dict[str, AttributeValue]]) -> TraceItemTableResponse:
    names = dict.fromkeys(name for row in rows for name in row)
    return TraceItemTableResponse(
        column_values=[
            TraceItemColumnValues(
                attribute_name=name,
                results=[row.get(name, AttributeValue(is_null=True)) for row in rows],
            )
            for name in names
        ]
    )


def artifact_row(
    item_id: int,
    *,
    project_id: int,
    trace_id: str = "a" * 32,
    seconds_ago: int = 0,
    **attributes: AttributeValue,
) -> dict[str, AttributeValue]:
    return {
        "itemId": AttributeValue(val_str=f"{item_id:032x}"),
        "traceId": AttributeValue(val_str=trace_id),
        "timestamp": AttributeValue(val_double=(NOW - timedelta(seconds=seconds_ago)).timestamp()),
        "projectId": AttributeValue(val_int=project_id),
        **attributes,
    }


@cell_silo_test
class ResolveArtifactContextTest(TestCase):
    def test_hidden_pending_deletion_workflow_and_unlinked_project_are_included(self):
        workflow = self.create_workflow(
            type=Workflow.Type.INBOX, status=ObjectStatus.PENDING_DELETION, enabled=False
        )
        linked_project = self.create_project()
        historical_project = self.create_project()
        detector = self.create_detector(project=linked_project)
        self.create_detector_workflow(detector=detector, workflow=workflow)
        self.create_project(organization=self.create_organization())

        context = resolve_artifact_context("workflow", str(workflow.id))

        assert context.organization.id == workflow.organization_id
        assert set(context.project_ids) == {linked_project.id, historical_project.id}
        assert context.item["id"] == str(workflow.id)
        assert context.item["context"]["enabled"] is False
        assert context.item["context"]["status"] == ObjectStatus.PENDING_DELETION
        assert context.item["context"]["type"] == Workflow.Type.INBOX
        assert context.item["context"]["detectors"][0]["id"] == str(detector.id)

    def test_detector_resolves_own_project_and_workflow(self):
        detector = self.create_detector(project=self.project)
        workflow = self.create_workflow()
        self.create_detector_workflow(detector=detector, workflow=workflow)
        self.create_project()

        context = resolve_artifact_context("detector", str(detector.id))

        assert context.project_ids == [self.project.id]
        assert context.item["organizationId"] == str(self.organization.id)
        assert context.item["projectId"] == str(self.project.id)
        assert context.item["context"]["workflows"][0]["id"] == str(workflow.id)

    def test_workflow_operational_metadata(self):
        triggers = self.create_data_condition_group()
        workflow = self.create_workflow(
            created_by_id=self.user.id,
            owner_user_id=self.user.id,
            when_condition_group=triggers,
            environment=self.environment,
            config={"frequency": 0},
        )

        context = resolve_artifact_context("workflow", str(workflow.id)).item["context"]

        assert context["dateAdded"] == workflow.date_added.isoformat()
        assert context["dateUpdated"] == workflow.date_updated.isoformat()
        assert context["createdById"] == str(self.user.id)
        assert context["ownerUserId"] == str(self.user.id)
        assert context["ownerTeamId"] is None
        assert context["whenConditionGroupId"] == str(triggers.id)
        assert context["environmentId"] == str(self.environment.id)
        assert context["environment"] == self.environment.name
        assert context["config"] == {"frequency": 0}

    def test_context_value_preserves_nested_numeric_id_types(self):
        raw_values = {
            "id": 42,
            "projectId": 43,
            "detectorIds": [44, 45],
            "nested": {"ownerId": 46, "ratioId": 1.5, "enabledId": False},
        }
        assert _context_value(raw_values) == raw_values

    def test_detector_operational_metadata(self):
        triggers = self.create_data_condition_group()
        detector = self.create_detector(
            created_by_id=self.user.id,
            owner_team_id=self.team.id,
            workflow_condition_group=triggers,
            description="Investigate new errors",
        )

        context = resolve_artifact_context("detector", str(detector.id)).item["context"]

        assert context["dateAdded"] == detector.date_added.isoformat()
        assert context["dateUpdated"] == detector.date_updated.isoformat()
        assert context["createdById"] == str(self.user.id)
        assert context["ownerUserId"] is None
        assert context["ownerTeamId"] == str(self.team.id)
        assert context["workflowConditionGroupId"] == str(triggers.id)
        assert context["description"] == "Investigate new errors"
        assert context["config"] == detector.config

    def test_optional_operational_metadata_is_explicitly_null(self):
        workflow = self.create_workflow()
        detector = self.create_detector()

        workflow_context = resolve_artifact_context("workflow", str(workflow.id)).item["context"]
        detector_context = resolve_artifact_context("detector", str(detector.id)).item["context"]

        for context in (workflow_context, detector_context):
            assert context["createdById"] is None
            assert context["ownerUserId"] is None
            assert context["ownerTeamId"] is None
        assert workflow_context["whenConditionGroupId"] is None
        assert detector_context["workflowConditionGroupId"] is None
        assert workflow_context["triggers"] is None
        assert detector_context["conditionGroup"] is None

    def test_error_detector_options_include_unset_keys_without_effective_defaults(self):
        detector = self.create_detector(project=self.project)
        self.project.delete_option("sentry:fingerprinting_rules")
        self.project.delete_option("sentry:resolve_age")
        self.project.update_option("unrelated:secret", "must not be returned")
        other_project = self.create_project()
        other_project.update_option("sentry:resolve_age", 24)

        context = resolve_artifact_context("detector", str(detector.id)).item["context"]

        assert set(context["projectOptions"]) == set(
            Detector.error_detector_project_options.values()
        )
        assert context["projectOptions"] == {
            "sentry:fingerprinting_rules": None,
            "sentry:resolve_age": None,
        }
        assert context["projectOptionSources"] == {
            "sentry:fingerprinting_rules": "unset",
            "sentry:resolve_age": "unset",
        }

    def test_error_detector_options_preserve_stored_false_and_zero(self):
        detector = self.create_detector(project=self.project)
        self.project.update_option("sentry:fingerprinting_rules", False)
        self.project.update_option("sentry:resolve_age", 0)

        context = resolve_artifact_context("detector", str(detector.id)).item["context"]

        assert context["projectOptions"]["sentry:fingerprinting_rules"] is False
        assert context["projectOptions"]["sentry:resolve_age"] == 0
        assert context["projectOptions"]["sentry:resolve_age"] is not None
        assert context["projectOptionSources"] == {
            "sentry:fingerprinting_rules": "project_option",
            "sentry:resolve_age": "project_option",
        }

    def test_error_detector_options_preserve_rule_text_and_age(self):
        detector = self.create_detector(project=self.project)
        self.project.update_option("sentry:fingerprinting_rules", "message:example -> custom-group")
        self.project.update_option("sentry:resolve_age", 48)

        context = resolve_artifact_context("detector", str(detector.id)).item["context"]

        assert context["projectOptions"] == {
            "sentry:fingerprinting_rules": "message:example -> custom-group",
            "sentry:resolve_age": 48,
        }

    def test_non_error_detector_does_not_include_error_project_options(self):
        detector = self.create_all_projects_detector(self.organization)
        self.project.update_option("sentry:resolve_age", 24)

        context = resolve_artifact_context("detector", str(detector.id)).item["context"]

        assert context["projectOptions"] == {}
        assert context["projectOptionSources"] == {}

    def test_workflow_preserves_all_condition_records_and_action_fields(self):
        triggers = self.create_data_condition_group(logic_type=DataConditionGroup.Type.ALL)
        filters = self.create_data_condition_group(logic_type=DataConditionGroup.Type.ANY)
        workflow = self.create_workflow(when_condition_group=triggers)
        self.create_workflow_data_condition_group(workflow=workflow, condition_group=filters)
        trigger_conditions = [
            self.create_data_condition(
                condition_group=triggers,
                type=Condition.EQUAL,
                comparison=value,
                condition_result=False,
            )
            for value in (False, 0, "")
        ]
        filter_conditions = [
            self.create_data_condition(
                condition_group=filters,
                type=Condition.GREATER,
                comparison=value,
                condition_result=0,
            )
            for value in (0, 10)
        ]
        action = self.create_action(
            type=Action.Type.EMAIL,
            data={},
            config={"target_identifier": "123", "target_type": ActionTarget.USER.value},
        )
        self.create_data_condition_group_action(condition_group=filters, action=action)

        context = resolve_artifact_context("workflow", str(workflow.id)).item["context"]

        assert context["triggers"] == {
            "id": str(triggers.id),
            "organizationId": str(self.organization.id),
            "logicType": "all",
            "conditions": [
                {
                    "id": str(condition.id),
                    "type": "eq",
                    "comparison": condition.comparison,
                    "conditionResult": False,
                }
                for condition in trigger_conditions
            ],
            "actions": [],
        }
        assert context["actionFilters"] == [
            {
                "id": str(filters.id),
                "organizationId": str(self.organization.id),
                "logicType": "any",
                "conditions": [
                    {
                        "id": str(condition.id),
                        "type": "gt",
                        "comparison": condition.comparison,
                        "conditionResult": 0,
                    }
                    for condition in filter_conditions
                ],
                "actions": [
                    {
                        "id": str(action.id),
                        "type": "email",
                        "integrationId": None,
                        "data": {},
                        "config": {"targetIdentifier": "123", "targetType": "user"},
                        "status": "active",
                    }
                ],
            }
        ]
        assert context["contextTruncated"] is False

    def test_detector_preserves_every_trigger_condition(self):
        triggers = self.create_data_condition_group(logic_type=DataConditionGroup.Type.ALL)
        detector = self.create_detector(workflow_condition_group=triggers)
        conditions = [
            self.create_data_condition(
                condition_group=triggers,
                comparison={"some_key": value},
                condition_result=value,
            )
            for value in (False, 0, "")
        ]

        context = resolve_artifact_context("detector", str(detector.id)).item["context"]

        assert context["conditionGroup"]["conditions"] == [
            {
                "id": str(condition.id),
                "type": "eq",
                "comparison": {"someKey": condition.condition_result},
                "conditionResult": condition.condition_result,
            }
            for condition in conditions
        ]
        assert context["contextTruncated"] is False

    def test_condition_groups_and_related_items_remain_organization_scoped(self):
        other_org = self.create_organization()
        foreign_triggers = self.create_data_condition_group(organization=other_org)
        self.create_data_condition(
            condition_group=foreign_triggers, comparison=True, condition_result=True
        )
        workflow = self.create_workflow(when_condition_group=foreign_triggers)
        detector = self.create_detector(workflow_condition_group=foreign_triggers)
        foreign_detector = self.create_detector(project=self.create_project(organization=other_org))
        foreign_workflow = self.create_workflow(organization=other_org)
        self.create_detector_workflow(workflow=workflow, detector=foreign_detector)
        self.create_detector_workflow(workflow=foreign_workflow, detector=detector)
        self.create_workflow_data_condition_group(
            workflow=workflow, condition_group=foreign_triggers
        )

        workflow_context = resolve_artifact_context("workflow", str(workflow.id)).item["context"]
        detector_context = resolve_artifact_context("detector", str(detector.id)).item["context"]

        assert workflow_context["whenConditionGroupId"] == str(foreign_triggers.id)
        assert workflow_context["triggers"] is None
        assert workflow_context["actionFilters"] == []
        assert workflow_context["detectors"] == []
        assert detector_context["workflowConditionGroupId"] == str(foreign_triggers.id)
        assert detector_context["conditionGroup"] is None
        assert detector_context["workflows"] == []

    def test_condition_cap_is_global_and_truncation_is_explicit(self):
        triggers = self.create_data_condition_group()
        filters = self.create_data_condition_group()
        workflow = self.create_workflow(when_condition_group=triggers)
        self.create_workflow_data_condition_group(workflow=workflow, condition_group=filters)
        conditions = [
            self.create_data_condition(
                condition_group=triggers, comparison=value, condition_result=True
            )
            for value in range(CONFIGURATION_ITEM_LIMIT - 1)
        ]
        last_condition = self.create_data_condition(
            condition_group=filters, comparison=0, condition_result=False
        )

        complete = resolve_artifact_context("workflow", str(workflow.id)).item["context"]

        assert len(complete["triggers"]["conditions"]) == len(conditions)
        assert complete["actionFilters"][0]["conditions"][0]["id"] == str(last_condition.id)
        assert complete["contextTruncated"] is False

        self.create_data_condition(condition_group=filters, comparison=1, condition_result=True)

        truncated = resolve_artifact_context("workflow", str(workflow.id)).item["context"]

        assert len(truncated["triggers"]["conditions"]) == CONFIGURATION_ITEM_LIMIT - 1
        assert len(truncated["actionFilters"][0]["conditions"]) == 1
        assert truncated["contextTruncated"] is True

    def test_action_cap_preserves_all_actions_until_truncation(self):
        filters = self.create_data_condition_group()
        workflow = self.create_workflow()
        self.create_workflow_data_condition_group(workflow=workflow, condition_group=filters)
        actions = [self.create_action() for _ in range(CONFIGURATION_ITEM_LIMIT)]
        for action in actions:
            self.create_data_condition_group_action(condition_group=filters, action=action)

        complete = resolve_artifact_context("workflow", str(workflow.id)).item["context"]

        assert [action["id"] for action in complete["actionFilters"][0]["actions"]] == [
            str(action.id) for action in actions
        ]
        assert complete["contextTruncated"] is False

        self.create_data_condition_group_action(condition_group=filters)

        truncated = resolve_artifact_context("workflow", str(workflow.id)).item["context"]

        assert len(truncated["actionFilters"][0]["actions"]) == CONFIGURATION_ITEM_LIMIT
        assert truncated["contextTruncated"] is True

    def test_group_cap_reserves_space_for_workflow_triggers(self):
        triggers = self.create_data_condition_group()
        workflow = self.create_workflow(when_condition_group=triggers)
        filters = [self.create_data_condition_group() for _ in range(RELATED_ITEM_LIMIT - 1)]
        for group in filters:
            self.create_workflow_data_condition_group(workflow=workflow, condition_group=group)

        complete = resolve_artifact_context("workflow", str(workflow.id)).item["context"]

        assert complete["triggers"]["id"] == str(triggers.id)
        assert [group["id"] for group in complete["actionFilters"]] == [
            str(group.id) for group in filters
        ]
        assert complete["contextTruncated"] is False

        self.create_workflow_data_condition_group(
            workflow=workflow, condition_group=self.create_data_condition_group()
        )

        truncated = resolve_artifact_context("workflow", str(workflow.id)).item["context"]

        assert truncated["triggers"]["id"] == str(triggers.id)
        assert len(truncated["actionFilters"]) == RELATED_ITEM_LIMIT - 1
        assert truncated["contextTruncated"] is True

    def test_projectless_detector_uses_configured_organization(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        detector = self.create_all_projects_detector(org)
        self.create_project()

        context = resolve_artifact_context("detector", str(detector.id))

        assert context.organization.id == org.id
        assert context.project_ids == [project.id]
        assert context.item["projectId"] is None
        assert context.item["organizationId"] == str(org.id)
        assert context.item["context"]["config"]["organization_id"] == org.id
        assert type(context.item["context"]["config"]["organization_id"]) is int

    def test_group_resolves_project_and_related_detector(self):
        group = self.create_group()
        detector = self.create_detector(project=self.project)
        self.create_detector_group(detector=detector, group=group)

        context = resolve_artifact_context("group", str(group.id))

        assert context.project_ids == [self.project.id]
        assert context.item["organizationId"] == str(self.organization.id)
        assert context.item["projectId"] == str(self.project.id)
        assert context.item["context"]["detectors"][0]["id"] == str(detector.id)

    def test_event_lookup_is_scoped_to_the_requested_project_and_tenant(self):
        event = self.store_event(
            data={"event_id": EVENT_ID, "message": "artifact event", "timestamp": NOW.timestamp()},
            project_id=self.project.id,
        )
        with patch(
            "sentry.workflow_engine.artifacts.eventstore.backend.get_event_by_id",
            return_value=event,
        ) as get_event:
            context = resolve_artifact_context("event", EVENT_ID, self.project.id)

        get_event.assert_called_once_with(
            self.project.id, EVENT_ID, tenant_ids={"organization_id": self.organization.id}
        )
        assert context.project_ids == [self.project.id]
        assert context.item["id"] == EVENT_ID

    def test_event_missing_in_selected_project_is_not_found(self):
        with patch(
            "sentry.workflow_engine.artifacts.eventstore.backend.get_event_by_id", return_value=None
        ):
            with pytest.raises(Http404):
                resolve_artifact_context("event", EVENT_ID, self.project.id)

    def assert_missing_database_object_is_not_found(self, item_type):
        with pytest.raises(Http404):
            resolve_artifact_context(item_type, str(2**63 - 1))

    def test_missing_workflow_is_not_found(self):
        self.assert_missing_database_object_is_not_found("workflow")

    def test_missing_detector_is_not_found(self):
        self.assert_missing_database_object_is_not_found("detector")

    def test_missing_group_is_not_found(self):
        self.assert_missing_database_object_is_not_found("group")


@cell_silo_test
class QueryArtifactsTest(TestCase):
    def context(self, item_type="workflow", item_id="123", project_ids=None):
        return ArtifactContext(
            organization=self.organization,
            project_ids=[self.project.id] if project_ids is None else project_ids,
            item={
                "type": item_type,
                "id": item_id,
                "organizationId": str(self.organization.id),
                "projectId": str(self.project.id),
                "name": "artifact item",
                "context": {},
            },
        )

    def assert_transport_request_enforces_item_tenant_project_time_and_storage(
        self, item_type, item_id, attribute, attribute_type, value
    ):
        project = self.create_project()
        context = self.context(item_type, item_id, [self.project.id, project.id])
        start = NOW - timedelta(days=1)
        with patch(
            "sentry.workflow_engine.artifacts.table_rpc", return_value=[TraceItemTableResponse()]
        ) as rpc:
            result = query_artifacts(context, start=start, end=NOW)

        assert result.artifacts == []
        assert result.truncated is False
        rpc.assert_called_once()
        request = rpc.call_args.args[0][0]
        assert request.meta.organization_id == self.organization.id
        assert list(request.meta.project_ids) == [self.project.id, project.id]
        assert (
            request.meta.trace_item_type
            == TraceItemType.TRACE_ITEM_TYPE_WORKFLOW_ENGINE_EVALUATION
            == 14
        )
        assert request.meta.start_timestamp.ToDatetime(tzinfo=UTC) == start
        assert request.meta.end_timestamp.ToDatetime(tzinfo=UTC) == NOW
        assert (
            request.meta.downsampled_storage_config.mode
            == DownsampledStorageConfig.MODE_HIGHEST_ACCURACY
        )
        assert request.filter.comparison_filter.key.name == attribute
        assert request.filter.comparison_filter.key.type == attribute_type
        assert request.filter.comparison_filter.op == ComparisonFilter.OP_EQUALS
        assert request.filter.comparison_filter.value == value
        assert request.limit == 101
        assert [(order.column.key.name, order.descending) for order in request.order_by] == [
            ("sentry.timestamp", True),
            ("sentry.item_id", True),
        ]

    def test_no_projects_means_no_unscoped_query(self):
        with patch("sentry.workflow_engine.artifacts.table_rpc") as rpc:
            result = query_artifacts(
                self.context(project_ids=[]), start=NOW - timedelta(days=1), end=NOW
            )
        assert result.artifacts == []
        assert result.truncated is False
        rpc.assert_not_called()

    def test_missing_values_are_not_false_or_zero_and_json_is_decoded(self):
        rows = [
            artifact_row(
                1,
                project_id=self.project.id,
                triggered=AttributeValue(val_bool=False),
                issue_status=AttributeValue(val_int=0),
                detector_id=AttributeValue(is_null=True),
                group_id=AttributeValue(),
                triggered_action_ids=AttributeValue(val_int_array=IntArray(values=[1, 2])),
                trigger_evaluation=AttributeValue(val_str='{"result":false,"input":null}'),
                filter_evaluations=AttributeValue(val_str='[{"result":true}]'),
                delayed=AttributeValue(val_str='{"scheduled":0}'),
            ),
            artifact_row(
                2,
                project_id=self.project.id,
                trigger_evaluation=AttributeValue(val_str="invalid historical JSON"),
            ),
        ]
        with patch(
            "sentry.workflow_engine.artifacts.table_rpc", return_value=[table_response(rows)]
        ) as rpc:
            result = query_artifacts(self.context(), start=NOW - timedelta(days=1), end=NOW)

        rpc.assert_called_once()
        by_id = {artifact["itemId"]: artifact for artifact in result.artifacts}
        attributes = by_id[f"{1:032x}"]["attributes"]
        assert attributes["triggered"] is False
        assert attributes["issue_status"] == 0
        assert attributes.get("detector_id") is None
        assert attributes.get("group_id") is None
        assert attributes["triggered_action_ids"] == [1, 2]
        assert attributes["trigger_evaluation"] == {"result": False, "input": None}
        assert attributes["filter_evaluations"] == [{"result": True}]
        assert attributes["delayed"] == {"scheduled": 0}
        assert by_id[f"{2:032x}"]["attributes"]["trigger_evaluation"] == "invalid historical JSON"
        assert by_id[f"{1:032x}"]["projectId"] == str(self.project.id)

    def assert_primary_row_cap_and_truncation(self, count, truncated):
        rows = [artifact_row(i, project_id=self.project.id) for i in range(count, 0, -1)]
        with patch(
            "sentry.workflow_engine.artifacts.table_rpc", return_value=[table_response(rows)]
        ) as rpc:
            result = query_artifacts(self.context(), start=NOW - timedelta(days=1), end=NOW)
        assert len(result.artifacts) == 100
        assert result.truncated is truncated
        assert result.artifacts[0]["itemId"] == f"{count:032x}"
        rpc.assert_called_once()

    def test_event_lookup_preserves_all_primary_rows_without_correlation_query(self):
        rows = [
            artifact_row(
                index,
                project_id=self.project.id,
                event_id=AttributeValue(val_str=EVENT_ID),
                **{attribute: AttributeValue(val_int=index)},
            )
            for index, attribute in enumerate(("workflow_id", "detector_id", "group_id"), 1)
        ]
        with patch(
            "sentry.workflow_engine.artifacts.table_rpc", return_value=[table_response(rows)]
        ) as rpc:
            result = query_artifacts(
                self.context("event", EVENT_ID), start=NOW - timedelta(days=1), end=NOW
            )

        rpc.assert_called_once()
        assert [artifact["itemId"] for artifact in result.artifacts] == [
            f"{index:032x}" for index in (3, 2, 1)
        ]
        by_id = {artifact["itemId"]: artifact for artifact in result.artifacts}
        for index, attribute in enumerate(("workflow_id", "detector_id", "group_id"), 1):
            assert by_id[f"{index:032x}"]["attributes"][attribute] == index
            assert by_id[f"{index:032x}"]["attributes"]["event_id"] == EVENT_ID
        assert result.truncated is False

    def test_event_backed_correlation_is_scoped_deduplicated_sorted_and_not_recursive(self):
        primary = artifact_row(
            1, project_id=self.project.id, seconds_ago=1, event_id=AttributeValue(val_str=EVENT_ID)
        )
        related = artifact_row(
            2, project_id=self.project.id, detector_id=AttributeValue(val_int=456)
        )
        related_other_project = artifact_row(1, project_id=self.project.id + 1)
        context = self.context(project_ids=[self.project.id, self.project.id + 1])
        with patch(
            "sentry.workflow_engine.artifacts.table_rpc",
            side_effect=[
                [table_response([primary])],
                [table_response([related, primary, related_other_project])],
            ],
        ) as rpc:
            result = query_artifacts(context, start=NOW - timedelta(days=1), end=NOW)

        assert rpc.call_count == 2
        first = rpc.call_args_list[0].args[0][0]
        expansion = rpc.call_args_list[1].args[0][0]
        assert expansion.meta == first.meta
        assert expansion.limit == 101
        assert expansion.filter.comparison_filter.key.name == "sentry.trace_id"
        assert expansion.filter.comparison_filter.op == ComparisonFilter.OP_IN
        assert list(expansion.filter.comparison_filter.value.val_str_array.values) == ["a" * 32]
        assert len(result.artifacts) == 3
        assert {(row["projectId"], row["itemId"]) for row in result.artifacts} == {
            (str(self.project.id), f"{1:032x}"),
            (str(self.project.id), f"{2:032x}"),
            (str(self.project.id + 1), f"{1:032x}"),
        }
        assert result.artifacts[0]["itemId"] == f"{2:032x}"
        assert result.truncated is False

    def test_eventless_detector_trace_does_not_expand(self):
        row = artifact_row(1, project_id=self.project.id, detector_id=AttributeValue(val_int=123))
        with patch(
            "sentry.workflow_engine.artifacts.table_rpc", return_value=[table_response([row])]
        ) as rpc:
            query_artifacts(self.context("detector"), start=NOW - timedelta(days=1), end=NOW)
        rpc.assert_called_once()

    def test_correlation_trace_cap_marks_truncation(self):
        rows = [
            artifact_row(
                i,
                project_id=self.project.id,
                trace_id=f"{i:032x}",
                event_id=AttributeValue(val_str=f"{i:032x}"),
            )
            for i in range(51, 0, -1)
        ]
        with patch(
            "sentry.workflow_engine.artifacts.table_rpc",
            side_effect=[[table_response(rows)], [TraceItemTableResponse()]],
        ) as rpc:
            result = query_artifacts(self.context(), start=NOW - timedelta(days=1), end=NOW)
        assert rpc.call_count == 2
        expansion = rpc.call_args_list[1].args[0][0]
        assert len(expansion.filter.comparison_filter.value.val_str_array.values) == 50
        assert result.truncated is True

    def test_expansion_row_cap_marks_truncation_and_bounds_total_results(self):
        primary = artifact_row(
            1000, project_id=self.project.id, event_id=AttributeValue(val_str=EVENT_ID)
        )
        expansion = [artifact_row(i, project_id=self.project.id) for i in range(101, 0, -1)]
        with patch(
            "sentry.workflow_engine.artifacts.table_rpc",
            side_effect=[[table_response([primary])], [table_response(expansion)]],
        ) as rpc:
            result = query_artifacts(self.context(), start=NOW - timedelta(days=1), end=NOW)
        assert rpc.call_count == 2
        assert len(result.artifacts) == 101
        assert result.truncated is True

    def test_workflow_transport_request_scope_and_types(self):
        self.assert_transport_request_enforces_item_tenant_project_time_and_storage(
            "workflow", "123", "workflow_id", AttributeKey.TYPE_INT, AttributeValue(val_int=123)
        )

    def test_detector_transport_request_scope_and_types(self):
        self.assert_transport_request_enforces_item_tenant_project_time_and_storage(
            "detector", "456", "detector_id", AttributeKey.TYPE_INT, AttributeValue(val_int=456)
        )

    def test_group_transport_request_scope_and_types(self):
        self.assert_transport_request_enforces_item_tenant_project_time_and_storage(
            "group", "789", "group_id", AttributeKey.TYPE_INT, AttributeValue(val_int=789)
        )

    def test_event_transport_request_scope_and_types(self):
        self.assert_transport_request_enforces_item_tenant_project_time_and_storage(
            "event",
            EVENT_ID,
            "event_id",
            AttributeKey.TYPE_STRING,
            AttributeValue(val_str=EVENT_ID),
        )

    def test_primary_exactly_at_row_cap_is_not_truncated(self):
        self.assert_primary_row_cap_and_truncation(100, False)

    def test_primary_over_row_cap_is_truncated(self):
        self.assert_primary_row_cap_and_truncation(101, True)
