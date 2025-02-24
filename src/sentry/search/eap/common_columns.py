from sentry.search.eap import constants
from sentry.search.eap.columns import ResolvedColumn

COMMON_COLUMNS = [
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
]
