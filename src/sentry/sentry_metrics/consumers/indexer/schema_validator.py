import random
from typing import Any, Optional

from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.ingest_metrics_v1 import IngestMetric

from sentry import options


class MetricsSchemaValidator:
    """
    MetricsSchemaValidator class implements schema validation. It takes into account whether
    schema validation should be performed based on some heuristics rather than appling the
    validation on all messages. This is done for performance reasons. It has been found during
    performance testing that skipping schema validation can improve the performance of the
    indexer by more than 100%. We want to be able to control this behavior with a configuration
    option so that we can choose to do schema validation based of different considerations like
      - How stable the use case is. If the use case is stable, we can choose to not do schema
        validation
      - How much we trust upstream to send valid messages. If we trust upstream to send valid
        messages, we can choose to not do schema validation.
      - How high the volume of data is. For high volume of data, we can choose to not do schema
        validation.

    Schema validation rules are followed in the following order:
      - If the configuration option is not set for any use case, then schema validation is applied
        to all messages of all use cases.
      - If the configuratin option is not defined for a use case, then schema validation is applied
        to all messages of that use case.
      - If the configuration option is defined for a use case, then schema validation is applied to
        messages of that use case based on the sample rate defined in the configuration option.
    """

    def __init__(self, input_codec: Optional[Codec[Any]], validation_option: Optional[str]) -> None:
        self.input_codec = input_codec
        self.validation_option = validation_option
        if self.validation_option:
            self.schema_validation_rules = options.get(self.validation_option, {})
        else:
            self.schema_validation_rules = {}

    def validate(self, use_case_id: str, message: IngestMetric) -> None:
        if not self.input_codec:
            return None

        validation_sample_rate = self.schema_validation_rules.get(use_case_id, 1.0)
        if random.random() <= validation_sample_rate:
            return self.input_codec.validate(message)
