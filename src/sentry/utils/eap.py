import logging
from typing import Any

import orjson
from sentry_kafka_schemas.codecs import Codec
from sentry_protos.snuba.v1.trace_item_pb2 import (
    AnyValue,
    ArrayValue,
    KeyValue,
    KeyValueList,
    TraceItem,
)

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.db.models.fields.bounded import I64_MAX
from sentry.utils.arroyo_producer import SingletonProducer, get_arroyo_producer

logger = logging.getLogger(__name__)

EAP_ITEMS_CODEC: Codec[TraceItem] = get_topic_codec(Topic.SNUBA_ITEMS)


def _get_eap_items_producer():
    """Get a Kafka producer for EAP TraceItems."""
    return get_arroyo_producer(
        "sentry.utils.eap_producer",
        Topic.SNUBA_ITEMS,
        exclude_config_keys=["compression.type", "message.max.bytes"],
    )


eap_items_producer = SingletonProducer(_get_eap_items_producer)


def encode_value(value: Any, *, dump_arrays: bool = False, expand_arrays: bool = False) -> AnyValue:
    if isinstance(value, str):
        return AnyValue(string_value=value)
    elif isinstance(value, bool):
        # Note: bool check must come before int check since bool is a subclass of int
        return AnyValue(bool_value=value)
    elif isinstance(value, int):
        if value > I64_MAX:
            return AnyValue(double_value=float(value))
        return AnyValue(int_value=value)
    elif isinstance(value, float):
        return AnyValue(double_value=value)
    elif isinstance(value, bytes):
        return AnyValue(bytes_value=value)
    elif dump_arrays and isinstance(value, (list, tuple, dict)):
        return AnyValue(string_value=orjson.dumps(value).decode())
    elif expand_arrays and isinstance(value, dict):
        return AnyValue(**value)
    elif isinstance(value, list) or isinstance(value, tuple):
        # Not yet processed on EAP side
        return AnyValue(
            array_value=ArrayValue(values=[encode_value(v) for v in value if v is not None])
        )
    elif isinstance(value, dict):
        # Not yet processed on EAP side
        return AnyValue(
            kvlist_value=KeyValueList(
                values=[
                    KeyValue(key=str(kv[0]), value=encode_value(kv[1]))
                    for kv in value.items()
                    if kv[1] is not None
                ]
            )
        )
    else:
        raise NotImplementedError(f"encode not supported for {type(value)}")
