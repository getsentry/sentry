from sentry import options
from sentry.search.eap import constants
from sentry.search.eap.columns import ResolvedAttribute, datetime_processor


def get_common_columns() -> list[ResolvedAttribute]:
    """Returns common columns used across EAP attribute definitions.

    The timestamp column's search_type is controlled by the 'eap.timestamp-search-type' option.
    """
    return [
        ResolvedAttribute(
            public_alias="organization.id",
            internal_name="sentry.organization_id",
            internal_type=constants.INT,
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="project.id",
            internal_name="sentry.project_id",
            internal_type=constants.INT,
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="project_id",
            internal_name="sentry.project_id",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="sentry.item_type",
            search_type="integer",
            internal_name="sentry.item_type",
            private=True,
        ),
        ResolvedAttribute(
            public_alias="sentry.organization_id",
            search_type="integer",
            internal_name="sentry.organization_id",
            private=True,
        ),
        ResolvedAttribute(
            public_alias=constants.TIMESTAMP_ALIAS,
            internal_name="sentry.timestamp",
            internal_type=constants.DOUBLE,
            search_type=options.get("eap.timestamp-search-type"),
            processor=datetime_processor,
        ),
    ]


# For backwards compatibility, evaluate once at module load time
COMMON_COLUMNS = get_common_columns()
