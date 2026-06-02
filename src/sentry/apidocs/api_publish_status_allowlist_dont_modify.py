"""
This list is tracking old api endpoints that we couldn't decide publish status for.
The goal is to eventually find owners for all and shrink this list.
DO NOT ADD ANY NEW APIS
"""

API_PUBLISH_STATUS_ALLOWLIST_DONT_MODIFY = {
    "/api/0/organizations/{organization_id_or_slug}/integrations/{integration_id}/serverless-functions/": {
        "GET",
        "POST",
    },
    "/api/0/organizations/{organization_id_or_slug}/invite-requests/": {"GET", "POST"},
    "/api/0/organizations/{organization_id_or_slug}/releases/{version}/assemble/": {"POST"},
    "/api/0/organizations/{organization_id_or_slug}/releases/{version}/files/": {"GET", "POST"},
    "/api/0/organizations/{organization_id_or_slug}/releases/{version}/files/{file_id}/": {
        "DELETE",
        "GET",
        "PUT",
    },
    "/api/0/organizations/{organization_id_or_slug}/sentry-app-installations/": {"GET"},
    "/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/hooks/": {"GET", "POST"},
    "/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/hooks/{hook_id}/stats/": {
        "GET"
    },
    "/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/releases/completion/": {"GET"},
    "/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/releases/{version}/stats/": {
        "GET"
    },
    "/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/releases/{version}/files/": {
        "GET",
        "POST",
    },
    "/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/releases/{version}/files/{file_id}/": {
        "DELETE",
        "GET",
        "PUT",
    },
    "/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/stats/": {"GET"},
    "/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/tags/": {"GET"},
    "/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/transfer/": {"POST"},
    "/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/repo-path-parsing/": {"POST"},
    "/api/0/users/{user_id}/organizations/": {"GET"},
    "/api/0/sentry-apps/{sentry_app_id_or_slug}/features/": {"GET"},
    "/api/0/sentry-apps/{sentry_app_id_or_slug}/stats/": {"GET"},
    "/api/0/sentry-app-installations/{uuid}/": {"DELETE", "GET", "PUT"},
    "/api/0/sentry-app-installations/{uuid}/external-issues/": {"POST"},
    "/api/0/sentry-app-installations/{uuid}/external-issues/{external_issue_id}/": {"DELETE"},
}
