from typing import Any

import orjson


def get_old_json_paths(filename: str) -> Any:
    try:
        with open(filename, "rb") as f:
            old_raw_paths = orjson.loads(f.read())["paths"]
    except OSError:
        raise Exception(
            "Generate old OpenAPI files before running this command. Run `make build-api-docs` directly."
        )
    return old_raw_paths


def get_old_json_components(filename: str) -> Any:
    try:
        with open(filename, "rb") as f:
            old_raw_components = orjson.loads(f.read())["components"]
    except OSError:
        raise Exception(
            "Generate old OpenAPI files before running this command. Run `make build-api-docs` directly."
        )
    return old_raw_components


OPENAPI_TAGS = [
    {
        "name": "Teams",
        "description": "Endpoints for teams",
        "x-display-description": False,
        "externalDocs": {
            "description": "Found an error? Let us know.",
            "url": "https://github.com/getsentry/sentry-docs/issues/new/?title=API%20Documentation%20Error:%20/api/teams/&template=api_error_template.md",
        },
    },
    {
        "name": "Organizations",
        "description": "Endpoints for organizations",
        "x-display-description": False,
        "externalDocs": {
            "description": "Found an error? Let us know.",
            "url": "https://github.com/getsentry/sentry-docs/issues/new/?title=API%20Documentation%20Error:%20/api/organizations/&template=api_error_template.md",
        },
    },
    {
        "name": "Projects",
        "description": "Endpoints for projects",
        "x-display-description": False,
        "externalDocs": {
            "description": "Found an error? Let us know.",
            "url": "https://github.com/getsentry/sentry-docs/issues/new/?title=API%20Documentation%20Error:%20/api/projects/&template=api_error_template.md",
        },
    },
    {
        "name": "Events",
        "x-sidebar-name": "Events & Issues",
        "description": "Endpoints for events and issues",
        "x-display-description": False,
        "externalDocs": {
            "description": "Found an error? Let us know.",
            "url": "https://github.com/getsentry/sentry-docs/issues/new/?title=API%20Documentation%20Error:%20/api/events/&template=api_error_template.md",
        },
    },
    {
        "name": "Releases",
        "description": "Endpoints for releases",
        "x-display-description": False,
        "externalDocs": {
            "description": "Found an error? Let us know.",
            "url": "https://github.com/getsentry/sentry-docs/issues/new/?title=API%20Documentation%20Error:%20/api/releases/&template=api_error_template.md",
        },
    },
    {
        "name": "Integration",
        "x-sidebar-name": "Integration Platform",
        "description": "Endpoints for the integration platform",
        "x-display-description": False,
        "externalDocs": {
            "description": "Found an error? Let us know.",
            "url": "https://github.com/getsentry/sentry-docs/issues/new/?title=API%20Documentation%20Error:%20/api/integration-platform/&template=api_error_template.md",
        },
    },
    {
        "name": "SCIM",
        "x-sidebar-name": "SCIM",
        "description": "System for Cross-Domain Identity Management ([SCIM](http://www.simplecloud.info/)) is a standard implemented by Identity Providers and applications in order to facilitate federated identity management. Through these APIs you can add and delete members as well as teams. Sentry SaaS customers must be on a Business Plan with SAML2 Enabled. SCIM uses a bearer token for authentication that is created when SCIM is enabled. For how to enable SCIM, see our docs [here](/product/accounts/sso/#scim-provisioning).\n Sentry's SCIM API does not currently support syncing passwords, or setting any User attributes other than `active`.",
        "x-display-description": True,
        "externalDocs": {
            "description": "Found an error? Let us know.",
            "url": "https://github.com/getsentry/sentry-docs/issues/new/?title=API%20Documentation%20Error:%20/api/integration-platform/&template=api_error_template.md",
        },
    },
    {
        # Not using visibility here since users won't be aware what that is, this "name" is only used in the URL so not
        # a big deal that its missing Performance
        "name": "Discover",
        "x-sidebar-name": "Discover & Performance",
        "description": "Discover and Performance allow you to slice and dice your Error and Transaction events",
        "x-display-description": True,
        "externalDocs": {
            "description": "Found an error? Let us know.",
            "url": "https://github.com/getsentry/sentry-docs/issues/new/?title=API%20Documentation%20Error:%20/api/integration-platform/&template=api_error_template.md",
        },
    },
    {
        "name": "Dashboards",
        "x-sidebar-name": "Dashboards",
        "description": "Endpoints for Dashboards",
        "x-display-description": False,
        "externalDocs": {
            "description": "Found an error? Let us know.",
            "url": "https://github.com/getsentry/sentry-docs/issues/new/?title=API%20Documentation%20Error:%20/api/integration-platform/&template=api_error_template.md",
        },
    },
    {
        "name": "Crons",
        "x-sidebar-name": "Crons",
        "description": "Endpoints for Crons",
        "x-display-description": False,
        "externalDocs": {
            "description": "Found an error? Let us know.",
            "url": "https://github.com/getsentry/sentry-docs/issues/new/?title=API%20Documentation%20Error:%20/api/integration-platform/&template=api_error_template.md",
        },
    },
    {
        "name": "Replays",
        "x-sidebar-name": "Replays",
        "description": "Endpoints for Replays",
        "x-display-description": False,
        "externalDocs": {
            "description": "Found an error? Let us know.",
            "url": "https://github.com/getsentry/sentry-docs/issues/new/?title=API%20Documentation%20Error:%20/api/integration-platform/&template=api_error_template.md",
        },
    },
    {
        "name": "Alerts",
        "x-sidebar-name": "Alerts & Notifications",
        "description": "Endpoints for Alerts and Notifications",
        "x-display-description": False,
        "externalDocs": {
            "description": "Found an error? Let us know.",
            "url": "https://github.com/getsentry/sentry-docs/issues/new/?title=API%20Documentation%20Error:%20/api/integration-platform/&template=api_error_template.md",
        },
    },
    {
        "name": "Integrations",
        "x-sidebar-name": "Integrations",
        "description": "Endpoints for Integrations",
        "x-display-description": False,
        "externalDocs": {
            "description": "Found an error? Let us know.",
            "url": "https://github.com/getsentry/sentry-docs/issues/new/?title=API%20Documentation%20Error:%20/api/integration-platform/&template=api_error_template.md",
        },
    },
    {
        "name": "Environments",
        "x-sidebar-name": "Environments",
        "description": "Endpoints for Environments",
        "x-display-description": False,
        "externalDocs": {
            "description": "Found an error? Let us know.",
            "url": "https://github.com/getsentry/sentry-docs/issues/new/?title=API%20Documentation%20Error:%20/api/integration-platform/&template=api_error_template.md",
        },
    },
    {
        "name": "Users",
        "x-sidebar-name": "Users",
        "description": "Endpoints for Users",
        "x-display-description": False,
        "externalDocs": {
            "description": "Found an error? Let us know.",
            "url": "https://github.com/getsentry/sentry-docs/issues/new/?title=API%20Documentation%20Error:%20/api/integration-platform/&template=api_error_template.md",
        },
    },
]
