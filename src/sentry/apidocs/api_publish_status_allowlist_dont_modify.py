"""
This list is tracking old api endpoints that we couldn't decide publish status for.
The goal is to eventually find owners for all and shrink this list.
DO NOT ADD ANY NEW APIS
"""

API_PUBLISH_STATUS_ALLOWLIST_DONT_MODIFY = {
    # Multipart file-upload POSTs — pending a dedicated approach to documenting
    # multipart/form-data request bodies. The GET on each path is documented + PRIVATE.
    "/api/0/organizations/{organization_id_or_slug}/releases/{version}/files/": {"POST"},
    "/api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/releases/{version}/files/": {
        "POST"
    },
}
