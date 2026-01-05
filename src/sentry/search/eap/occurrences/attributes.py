from sentry.search.eap import constants
from sentry.search.eap.columns import ResolvedAttribute
from sentry.search.eap.common_columns import COMMON_COLUMNS
from sentry.utils.validators import is_event_id_or_list

OCCURRENCE_ATTRIBUTE_DEFINITIONS = {
    column.public_alias: column
    for column in (
        COMMON_COLUMNS
        + [
            ResolvedAttribute(
                public_alias="id",
                internal_name="sentry.item_id",
                search_type="string",
                validator=is_event_id_or_list,
            ),
            ResolvedAttribute(
                public_alias="group_id",
                internal_name="group_id",
                search_type="integer",
            ),
            ResolvedAttribute(
                public_alias=constants.TRACE_ALIAS,
                internal_name="sentry.trace_id",
                search_type="string",
                validator=is_event_id_or_list,
            ),
            ResolvedAttribute(
                public_alias="level",
                internal_name="level",
                search_type="string",
            ),
        ]
    )
}
