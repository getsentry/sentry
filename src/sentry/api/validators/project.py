from rest_framework.exceptions import PermissionDenied

from sentry.constants import ALL_ACCESS_PROJECTS


def validate_project_ids(raw_project_ids, associated_projects):
    raw_project_ids = set(raw_project_ids)

    # Don't need to check all projects or my projects
    if raw_project_ids == ALL_ACCESS_PROJECTS or len(raw_project_ids) == 0:
        return raw_project_ids

    # Check that there aren't projects in the query the user doesn't have access to
    if len(raw_project_ids - set(associated_projects)) > 0:
        raise PermissionDenied

    return raw_project_ids
