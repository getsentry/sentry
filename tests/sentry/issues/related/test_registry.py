from sentry.issues.related.registry import RELATION_TYPES
from sentry.issues.related.types import RelationType


def test_every_relation_type_is_defined_once() -> None:
    # In the enum's order, which is the order of meta.types in the response
    assert [definition.type for definition in RELATION_TYPES] == list(RelationType)
