"""
This list is tracking old api endpoints that we couldn't decide publish status for.
The goal is to eventually find owners for all and shrink this list.
DO NOT ADD ANY NEW APIS
"""

API_PUBLISH_STATUS_ALLOWLIST_DONT_MODIFY = {
    "/api/0/organizations/{organization_id_or_slug}/releases/{version}/assemble/": {"POST"},
    "/api/0/organizations/{organization_id_or_slug}/releases/{version}/files/": {"GET", "POST"},
    "/api/0/organizations/{organization_id_or_slug}/releases/{version}/files/{file_id}/": {
        "DELETE",
        "GET",
        "PUT",
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
}
