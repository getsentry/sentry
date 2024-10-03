from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.types import ResolvedColumn

STRING = AttributeKey.TYPE_STRING
BOOLEAN = AttributeKey.TYPE_BOOLEAN
FLOAT = AttributeKey.TYPE_FLOAT
INT = AttributeKey.TYPE_INT


def uuid_validator(col: ResolvedColumn, string: str):
    if len(string) == 16:
        return True
    raise InvalidSearchQuery(f"{string} is an invalid value for {col.public_alias}")


SPAN_COLUMN_DEFINITIONS = {
    "id": ResolvedColumn(
        snuba_alias="id",
        proto_definition=AttributeKey(name="span_id", type=STRING),
        validator=uuid_validator,
    ),
    "organization.id": ResolvedColumn(
        snuba_alias="organization.id",
        proto_definition=AttributeKey(name="organization_id", type=STRING),
    ),
    "span.action": ResolvedColumn(
        snuba_alias="span.action",
        proto_definition=AttributeKey(name="action", type=STRING),
    ),
    "span.description": ResolvedColumn(
        snuba_alias="span.description",
        proto_definition=AttributeKey(name="name", type=STRING),
    ),
    "span.op": ResolvedColumn(
        snuba_alias="span.op",
        proto_definition=AttributeKey(name="op", type=STRING),
    ),
}
