from sentry.testutils.cases import APITransactionTestCase, SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationReplayTraceItemsEndpointTest(
    APITransactionTestCase,
    SnubaTestCase,
    SpanTestCase,
):
    view = "sentry-api-0-organization-trace-item-attributes-ranked"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.ten_mins_ago = before_now(minutes=10)

    def _store_span(self, description=None, tags=None, duration=None):
        if tags is None:
            tags = {"foo": "bar"}

        self.store_span(
            self.create_span(
                {"description": description or "foo", "sentry_tags": tags},
                start_ts=self.ten_mins_ago,
                duration=duration or 1000,
            ),
            is_eap=True,
        )

    # def test_distribution_values(self):
    #     tags = [
    #         ({"browser": "chrome", "device": "desktop"}, 500),
    #         ({"browser": "chrome", "device": "mobile"}, 100),
    #         ({"browser": "chrome", "device": "mobile"}, 100),
    #         ({"browser": "chrome", "device": "desktop"}, 100),
    #         ({"browser": "safari", "device": "mobile"}, 100),
    #         ({"browser": "chrome", "device": "desktop"}, 500),
    #         ({"browser": "edge", "device": "desktop"}, 500),
    #     ]

    #     for tag, duration in tags:
    #         self._store_span(tags=tag, duration=duration)

    #     snuba_params = SnubaParams(
    #         start=before_now(minutes=20),
    #         end=before_now(minutes=0),
    #         environments=[],
    #         projects=[self.project],
    #         user=None,
    #         teams=[],
    #         organization=self.organization,
    #         query_string="",
    #         sampling_mode="BEST_EFFORT",
    #         debug="debug",
    #     )

    #     result = run_table_query(
    #         snuba_params,
    #         "",
    #         ["count(span.duration)"],
    #         None,
    #         config=SearchResolverConfig(use_aggregate_conditions=False),
    #         offset=0,
    #         limit=1,
    #         sampling_mode="BEST_EFFORT",
    #         referrer=Referrer.API_SPAN_SAMPLE_GET_SPAN_DATA.value,
    #     )

    #     print(result)
    #     assert False

    def test(self):
        import datetime

        from sentry.replays.lib.eap.snuba_transpiler import as_eap_request, execute_query

        tags = [
            ({"browser": "chrome", "device": "desktop"}, 500),
            ({"browser": "chrome", "device": "mobile"}, 100),
            ({"browser": "chrome", "device": "mobile"}, 100),
            ({"browser": "chrome", "device": "desktop"}, 100),
            ({"browser": "safari", "device": "mobile"}, 100),
            ({"browser": "chrome", "device": "desktop"}, 500),
            ({"browser": "edge", "device": "desktop"}, 500),
        ]

        for tag, duration in tags:
            self._store_span(tags=tag, duration=duration)

        import uuid

        from snuba_sdk import Column, Entity, Query

        query = Query(match=Entity("trace_items"), select=[Column("browser")])

        req = as_eap_request(
            query,
            meta={
                "cogs_category": "",
                "debug": False,
                "end_datetime": datetime.datetime.now(),
                "organization_id": 1,
                "project_ids": [1],
                "referrer": "test",
                "request_id": str(uuid.uuid4()),
                "start_datetime": datetime.datetime.now(),
                "trace_item_type": "replay",
            },
            settings={
                "attribute_types": {"browser": str},
                "default_limit": 25,
                "default_offset": 0,
                "extrapolation_mode": "none",
            },
            virtual_columns=[],
        )
        print(req)
        res = execute_query(req, referrer="test")
        print(res)

        assert False

        # from google.protobuf.timestamp_pb2 import Timestamp
        # from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column as EAPColumn
        # from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import TraceItemTableRequest
        # from sentry_protos.snuba.v1.request_common_pb2 import (
        #     TRACE_ITEM_TYPE_REPLAY,
        #     PageToken,
        #     RequestMeta,
        # )

        # # meta {
        # #     organization_id: 4556506305921024
        # #     referrer: "api.spans.sample-get-span-data"
        # #     project_ids: 4556506306052097
        # #     start_timestamp {
        # #     seconds: 1753889050
        # #     nanos: 595000000
        # #     }
        # #     end_timestamp {
        # #     seconds: 1753890250
        # #     nanos: 595000000
        # #     }
        # #     trace_item_type: TRACE_ITEM_TYPE_SPAN
        # #     downsampled_storage_config {
        # #     mode: MODE_BEST_EFFORT
        # #     }
        # # }
        # # columns {
        # #     aggregation {
        # #     aggregate: FUNCTION_COUNT
        # #     key {
        # #         type: TYPE_DOUBLE
        # #         name: "sentry.duration_ms"
        # #     }
        # #     label: "count(span.duration)"
        # #     extrapolation_mode: EXTRAPOLATION_MODE_SAMPLE_WEIGHTED
        # #     }
        # #     label: "count(span.duration)"
        # # }
        # # limit: 1
        # # page_token {
        # #     offset: 0
        # # }
        # from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
        #     AttributeAggregation,
        #     AttributeKey,
        #     AttributeValue,
        #     DoubleArray,
        #     IntArray,
        #     StrArray,
        #     VirtualColumnContext,
        # )

        # from sentry.utils.snuba_rpc import table_rpc

        # t1 = Timestamp()
        # t1.FromSeconds(0)

        # t2 = Timestamp()
        # t2.FromSeconds(1)

        # def categorize_column(
        #     column: AnyResolved,
        # ) -> Column:
        #     # Can't do bare literals, so they're actually formulas with +0
        #     if isinstance(column, (ResolvedFormula, ResolvedEquation, ResolvedLiteral)):
        #         return Column(formula=column.proto_definition, label=column.public_alias)
        #     elif isinstance(column, ResolvedAggregate):
        #         return Column(aggregation=column.proto_definition, label=column.public_alias)
        #     elif isinstance(column, ResolvedConditionalAggregate):
        #         return Column(
        #             conditional_aggregation=column.proto_definition, label=column.public_alias
        #         )
        #     else:
        #         return Column(key=column.proto_definition, label=column.public_alias)

        # table_rpc(
        #     requests=[
        #         TraceItemTableRequest(
        #             meta=RequestMeta(
        #                 organization_id=1,
        #                 referrer="xyz",
        #                 project_ids=[1],
        #                 start_timestamp=t1,
        #                 end_timestamp=t2,
        #                 trace_item_type=TRACE_ITEM_TYPE_REPLAY,
        #                 downsampled_storage_config=None,
        #             ),
        #             columns=[],
        #             filter=None,
        #             order_by=[
        #                 TraceItemTableRequest.OrderBy(
        #                     column=EAPColumn(
        #                         key=AttributeKey(
        #                             name="project.id",
        #                             type=AttributeKey.TYPE_INT,
        #                         ),
        #                         label="project_id",
        #                     ),
        #                     descending=True,
        #                 )
        #             ],
        #             group_by=None,
        #             limit=1,
        #             page_token=PageToken(offset=0),
        #             virtual_column_contexts=None,
        #             aggregation_filter=None,
        #         )
        #     ]
        # )
        # )
