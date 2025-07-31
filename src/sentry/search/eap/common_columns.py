from sentry.search.eap import constants
from sentry.search.eap.columns import ResolvedAttribute, datetime_processor

COMMON_COLUMNS = [
    ResolvedAttribute(
        public_alias="organization.id",
        internal_name="sentry.organization_id",
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
        public_alias="timestamp",
        internal_name="sentry.timestamp",
        internal_type=constants.DOUBLE,
        search_type="string",
        processor=datetime_processor,
    ),
]
