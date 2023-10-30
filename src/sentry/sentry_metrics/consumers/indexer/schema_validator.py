import random
from abc import ABC, abstractmethod
from typing import Any, Optional

from sentry_kafka_schemas.codecs import Codec, ValidationError

from sentry import options
from sentry.sentry_metrics.consumers.indexer.parsed_message import ParsedMessage


class MetricsSchemaValidator(ABC):
    @abstractmethod
    def validate(self, message: ParsedMessage) -> None:
        """
        This method tells whether a message is valid or not. It should raise a
        ValidationError if the message is not valid. Else it should return None.
        """
        pass


class GenericMetricsSchemaValidator(MetricsSchemaValidator):
    """
    GenericMetricsSchemaValidator class implements schema validation on the generic metrics
    pipeline. It takes into account whether schema validation should be performed based on
    some heuristics rather than appling the validation on all messages. This is done for
    performance reasons. It has been found during performance testing that skipping schema
    validation can improve the performance of the indexer by more than 100%. We want to be
    able to control this behavior with a configuration option so that we can choose to do
    schema validation based of different considerations like
      - How stable the use case is. If the use case is stable, we can choose to not do schema
        validation
      - How much we trust upstream to send valid messages. If we trust upstream to send valid
        messages, we can choose to not do schema validation.
      - How high the volume of data is. For high volume of data, we can choose to not do schema
        validation.
    """

    def __init__(self, input_codec: Optional[Codec[Any]]) -> None:
        self.input_codec = input_codec
        self.schema_validation_rules = options.get(
            "sentry-metrics.indexer.generic-metrics.schema-validation-rules", {}
        )

    def validate(self, message: ParsedMessage) -> None:
        if not self.input_codec:
            return None

        if not message["use_case_id"]:
            raise ValidationError("Use case id is not set")

        validation_sample_rate = self.schema_validation_rules.get(message["use_case_id"], 1.0)
        if random.random() <= validation_sample_rate:
            self.input_codec.validate(message)


class ReleaseHealthMetricsSchemaValidator(MetricsSchemaValidator):
    """
    ReleaseHealthMetricsSchemaValidator implements methods to validate the schema of release
    health metrics messages. It is used by the release health metrics pipeline.
    """

    def __init__(self, input_codec: Optional[Codec[Any]]) -> None:
        self.input_codec = input_codec

    def validate(self, message: ParsedMessage) -> None:
        if not self.input_codec:
            return None

        self.input_codec.validate(message)
