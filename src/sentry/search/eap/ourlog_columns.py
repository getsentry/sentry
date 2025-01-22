from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.search.eap import constants
from sentry.search.eap.columns import (
    ColumnDefinitions,
    ResolvedColumn,
    datetime_processor,
    project_context_constructor,
    simple_sentry_field,
)
from sentry.utils.validators import is_event_id, is_span_id

OURLOG_ATTRIBUTE_DEFINITIONS = {
    column.public_alias: column
    for column in [
        ResolvedColumn(
            public_alias="span_id",
            internal_name="sentry.span_id",
            search_type="string",
            validator=is_span_id,
        ),
        ResolvedColumn(
            public_alias="organization.id",
            internal_name="sentry.organization_id",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="project.id",
            internal_name="sentry.project_id",
            internal_type=constants.INT,
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="project_id",
            internal_name="sentry.project_id",
            internal_type=constants.INT,
            search_type="string",
            secondary_alias=True,
        ),
        ResolvedColumn(
            public_alias="log.body",
            internal_name="sentry.body",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="log.severity_number",
            internal_name="sentry.severity_number",
            search_type="number",
        ),
        ResolvedColumn(
            public_alias="log.severity_text",
            internal_name="sentry.severity_text",
            search_type="string",
        ),
        ResolvedColumn(
            public_alias="description",
            internal_name="sentry.name",
            search_type="string",
            secondary_alias=True,
        ),
        # Message maps to body, this is to allow wildcard searching
        ResolvedColumn(
            public_alias="message",
            internal_name="sentry.body",
            search_type="string",
            secondary_alias=True,
        ),
        ResolvedColumn(
            public_alias="trace",
            internal_name="sentry.trace_id",
            search_type="string",
            validator=is_event_id,
        ),
        ResolvedColumn(
            public_alias="timestamp",
            internal_name="sentry.timestamp",
            search_type="string",
            processor=datetime_processor,
        ),
        simple_sentry_field("browser.name"),
        simple_sentry_field("environment"),
    ]
}

OURLOG_VIRTUAL_CONTEXTS = {
    "project": project_context_constructor("project"),
    "project.slug": project_context_constructor("project.slug"),
    "project.name": project_context_constructor("project.name"),
}


OURLOG_DEFINITIONS = ColumnDefinitions(
    functions={},
    columns=OURLOG_ATTRIBUTE_DEFINITIONS,
    contexts=OURLOG_VIRTUAL_CONTEXTS,
    trace_item_type=TraceItemType.TRACE_ITEM_TYPE_LOG,
)
