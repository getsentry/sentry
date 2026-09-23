from datetime import timedelta
from typing import Any
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.backends.local.backend import LocalBroker
from arroyo.backends.local.storages.memory import MemoryMessageStorage
from arroyo.types import Partition
from arroyo.types import Topic as ArroyoTopic
from django.utils import timezone
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column, TraceItemTableRequest
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry.conf.types.kafka_definition import Topic
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.utils import json, snuba_rpc
from sentry.utils.kafka_config import get_topic_definition
from sentry.workflow_engine.handlers.condition.event_frequency_query_handlers import (
    EventFrequencyQueryHandler,
)
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors import evaluation_eap
from sentry.workflow_engine.processors.delayed_workflow import (
    EventInstance,
    EventKey,
    EventRedisData,
    UniqueConditionQuery,
    get_groups_to_fire,
)
from sentry.workflow_engine.processors.evaluation_logging import (
    emit_workflow_evaluations,
    redact_evaluation_artifact,
)
from sentry.workflow_engine.tasks.workflows import process_workflows_event


class EvaluationEAPIntegrationTest(TestCase, SnubaTestCase):
    """Real evaluation -> production Kafka bytes -> EAP ingest -> table RPC.

    LocalBroker substitutes for the network Kafka hop. The artifact builders,
    serialization/codec, EAP ingestion, and readback are not mocked.
    """

    def setUp(self) -> None:
        super().setUp()
        self.storage = MemoryMessageStorage[KafkaPayload]()
        broker = LocalBroker(self.storage)
        topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"])
        broker.create_topic(topic, partitions=1)
        self.partition = Partition(topic, 0)
        self.enterContext(
            mock.patch.object(
                evaluation_eap._eap_producer, "_inner_producer", broker.get_producer()
            )
        )
        self.enterContext(
            self.feature(
                [
                    evaluation_eap.EAP_FEATURE,
                    "organizations:workflow-engine-log-evaluations",
                ]
            )
        )
        self.trigger = self.create_data_condition_group()
        self.condition = self.create_data_condition(
            condition_group=self.trigger,
            type=Condition.EVERY_EVENT,
            comparison=True,
            condition_result=True,
        )
        self.workflow = self.create_workflow(when_condition_group=self.trigger)
        self.create_detector_workflow(
            detector=Detector.get_issue_stream_detector_for_project(self.project.id),
            workflow=self.workflow,
        )
        self.event = self.store_event(
            project_id=self.project.id,
            data={"user": {"email": "user@example.com"}, "extra": {"nested": [None, False, 42]}},
        )
        self.group = self.event.group
        assert self.group is not None

    def _process_event(self) -> None:
        process_workflows_event(
            event_id=self.event.event_id,
            group_id=self.group.id,
            occurrence_id=None,
            group_state={
                "id": self.group.id,
                "is_new": True,
                "is_regression": False,
                "is_new_group_environment": True,
            },
            has_escalated=False,
        )

    def _persist_one_item(self) -> TraceItem:
        message = self.storage.consume(self.partition, 0)
        assert message is not None
        assert self.storage.consume(self.partition, 1) is None
        item = evaluation_eap.EAP_ITEMS_CODEC.decode(message.payload.value)
        assert item.item_type == TraceItemType.TRACE_ITEM_TYPE_WORKFLOW_ENGINE_EVALUATION
        self.store_eap_items([item])
        return item

    def _query_artifacts(
        self,
        *,
        organization_id: int | None = None,
        project_id: int | None = None,
        item_type: TraceItemType.ValueType = TraceItemType.TRACE_ITEM_TYPE_WORKFLOW_ENGINE_EVALUATION,
    ) -> list[dict[str, Any]]:
        now = timezone.now()
        start = Timestamp()
        start.FromDatetime(now - timedelta(hours=1))
        end = Timestamp()
        end.FromDatetime(now + timedelta(hours=1))
        response = snuba_rpc.table_rpc(
            [
                TraceItemTableRequest(
                    meta=RequestMeta(
                        organization_id=organization_id or self.organization.id,
                        project_ids=[project_id or self.project.id],
                        trace_item_type=item_type,
                        referrer="test.workflow_engine.evaluation_artifacts",
                        start_timestamp=start,
                        end_timestamp=end,
                    ),
                    columns=[
                        Column(
                            label="artifact",
                            key=AttributeKey(name="artifact", type=AttributeKey.TYPE_STRING),
                        )
                    ],
                    limit=10,
                )
            ]
        )[0]
        return [
            json.loads(value.val_str)
            for column in response.column_values
            for value in column.results
        ]

    def test_workflow_event_round_trip_and_redacted_log(self) -> None:
        with mock.patch("sentry.workflow_engine.tasks.workflows.logger") as logger:
            self._process_event()
        item = self._persist_one_item()
        [artifact] = self._query_artifacts()
        assert artifact == json.loads(item.attributes["artifact"].string_value)
        assert artifact["workflow_id"] == self.workflow.id
        assert artifact["event_id"] == self.event.event_id
        assert artifact["evaluation_phase"] == "initial"
        assert artifact["outcome"] == "no_actions"
        condition = artifact["trigger_evaluation"]["condition_evaluations"][0]
        assert condition["condition_id"] == self.condition.id
        assert condition["input"]["event"]["user"]["email"] == "user@example.com"
        assert condition["input"]["event"]["extra"]["nested"] == [None, False, 42]
        assert logger.info.call_args_list[0].kwargs["extra"] == redact_evaluation_artifact(artifact)
        assert "user@example.com" not in str(logger.info.call_args_list)

    def test_disabled_flag_keeps_only_redacted_logs(self) -> None:
        with (
            self.feature({evaluation_eap.EAP_FEATURE: False}),
            mock.patch("sentry.workflow_engine.tasks.workflows.logger") as logger,
        ):
            self._process_event()
        assert self.storage.consume(self.partition, 0) is None
        assert self._query_artifacts() == []
        assert logger.info.call_args_list[0].kwargs["extra"]["workflow_id"] == self.workflow.id
        assert "user@example.com" not in str(logger.info.call_args_list)

    def test_artifacts_are_scoped_and_not_logs(self) -> None:
        self._process_event()
        self._persist_one_item()
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        assert len(self._query_artifacts()) == 1
        assert self._query_artifacts(organization_id=other_org.id) == []
        assert self._query_artifacts(project_id=other_project.id) == []
        assert self._query_artifacts(item_type=TraceItemType.TRACE_ITEM_TYPE_LOG) == []

    def test_delayed_evaluation_round_trip(self) -> None:
        # A real slow-condition evaluation, with an already-fetched query result.
        # Avoid depending on the unrelated Snuba query aggregation setup here.
        slow_condition = self.create_data_condition(
            condition_group=self.trigger,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={"interval": "1h", "value": 10},
            condition_result=True,
        )
        events = EventRedisData(
            events={
                EventKey(
                    workflow_id=self.workflow.id,
                    group_id=self.group.id,
                    when_dcg_id=self.trigger.id,
                    if_dcg_ids=frozenset(),
                    passing_dcg_ids=frozenset(),
                    original_key="evaluation-test",
                ): EventInstance(event_id=self.event.event_id),
            }
        )
        result = get_groups_to_fire(
            [self.trigger],
            {self.workflow.id: None},
            events,
            {
                UniqueConditionQuery(
                    handler=EventFrequencyQueryHandler, interval="1h", environment_id=None
                ): {self.group.id: 42}
            },
            {self.trigger.id: [slow_condition]},
            project_id=self.project.id,
        )
        logger = mock.MagicMock()
        emit_workflow_evaluations(logger, organization=self.organization, result=result)
        self._persist_one_item()
        [artifact] = self._query_artifacts()
        assert artifact["evaluation_phase"] == "delayed"
        assert artifact["trigger_evaluation"]["condition_evaluations"][0]["input"] == [42]
        assert (
            logger.info.call_args.kwargs["extra"]["trigger_evaluation"]["condition_evaluations"][0][
                "input"
            ]
            is None
        )
