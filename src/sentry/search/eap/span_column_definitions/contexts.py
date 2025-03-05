from sentry_protos.snuba.v1.trace_item_attribute_pb2 import VirtualColumnContext

from sentry.search.eap import constants
from sentry.search.eap.columns import (
    VirtualColumnDefinition,
    project_context_constructor,
    project_term_resolver,
)
from sentry.search.events.constants import SPAN_MODULE_CATEGORY_VALUES
from sentry.search.events.types import SnubaParams
from sentry.search.utils import DEVICE_CLASS


def device_class_context_constructor(params: SnubaParams) -> VirtualColumnContext:
    # EAP defaults to lower case `unknown`, but in querybuilder we used `Unknown`
    value_map = {"": "Unknown"}
    for device_class, values in DEVICE_CLASS.items():
        for value in values:
            value_map[value] = device_class
    return VirtualColumnContext(
        from_column_name="sentry.device.class",
        to_column_name="device.class",
        value_map=value_map,
    )


def module_context_constructor(params: SnubaParams) -> VirtualColumnContext:
    value_map = {key: key for key in SPAN_MODULE_CATEGORY_VALUES}
    return VirtualColumnContext(
        from_column_name="sentry.category",
        to_column_name="span.module",
        value_map=value_map,
    )


SPAN_VIRTUAL_CONTEXTS = {
    "device.class": VirtualColumnDefinition(
        constructor=device_class_context_constructor,
        filter_column="sentry.device.class",
        # TODO: need to change this so the VCC is using it too, but would require rewriting the term_resolver
        default_value="Unknown",
    ),
    "span.module": VirtualColumnDefinition(
        constructor=module_context_constructor,
    ),
}

for key in constants.PROJECT_FIELDS:
    SPAN_VIRTUAL_CONTEXTS[key] = VirtualColumnDefinition(
        constructor=project_context_constructor(key),
        term_resolver=project_term_resolver,
        filter_column="project.id",
    )
