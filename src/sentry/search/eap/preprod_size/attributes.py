from sentry.search.eap import constants
from sentry.search.eap.columns import ResolvedAttribute, datetime_processor
from sentry.search.eap.common_columns import COMMON_COLUMNS

PREPROD_SIZE_ATTRIBUTE_DEFINITIONS = {
    column.public_alias: column
    for column in COMMON_COLUMNS
    + [
        ResolvedAttribute(
            public_alias="metrics_artifact_type",
            internal_name="metrics_artifact_type",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="max_install_size",
            internal_name="max_install_size",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="max_download_size",
            internal_name="max_download_size",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="artifact_type",
            internal_name="artifact_type",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="app_id",
            internal_name="app_id",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="app_name",
            internal_name="app_name",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="build_version",
            internal_name="build_version",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="build_number",
            internal_name="build_number",
            search_type="integer",
        ),
        ResolvedAttribute(
            public_alias="build_configuration_name",
            internal_name="build_configuration_name",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="git_head_ref",
            internal_name="git_head_ref",
            search_type="string",
        ),
        ResolvedAttribute(
            public_alias="timestamp",
            internal_name="sentry.timestamp",
            internal_type=constants.DOUBLE,
            search_type="string",
            processor=datetime_processor,
        ),
    ]
}
