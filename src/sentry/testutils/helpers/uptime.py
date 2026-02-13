from sentry_kafka_schemas.schema_types.uptime_results_v1 import Assertion

MOCK_ASSERTION_FAILURE_DATA: Assertion = {
    "root": {
        "op": "and",
        "children": [
            {
                "op": "not",
                "operand": {
                    "op": "json_path",
                    "value": '$.components[?@.status == "operational"]',
                },
            }
        ],
    }
}
