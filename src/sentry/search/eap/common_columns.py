from sentry.search.eap import constants
from sentry.search.eap.columns import (
    ResolvedAttribute,
    VirtualColumnDefinition,
    datetime_processor,
    project_context_constructor,
    project_term_resolver,
)

_PROJECT_VIRTUAL_CONTEXTS: dict[str, VirtualColumnDefinition] = {
    key: VirtualColumnDefinition(
        constructor=project_context_constructor(key),
        term_resolver=project_term_resolver,
        filter_column="project.id",
    )
    for key in constants.PROJECT_FIELDS
}


def project_virtual_contexts() -> dict[str, VirtualColumnDefinition]:
    """Return a fresh copy of the shared project-field virtual column definitions."""
    return _PROJECT_VIRTUAL_CONTEXTS.copy()


COMMON_COLUMNS = [
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
        search_type="string",
        processor=datetime_processor,
    ),
]
