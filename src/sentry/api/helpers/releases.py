from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from sentry.api.exceptions import ResourceDoesNotExist
from sentry.constants import ObjectStatus
from sentry.models.grouplink import GroupLink
from sentry.models.groupresolution import GroupResolution
from sentry.models.organization import Organization
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.organizations.services.organization import RpcOrganization


def get_group_ids_resolved_in_release(
    organization: Organization | RpcOrganization, version: str
) -> set[int]:
    try:
        release = Release.objects.get(version=version, organization_id=organization.id)
    except Release.DoesNotExist:
        raise ResourceDoesNotExist

    group_ids = set(
        GroupResolution.objects.filter(release=release).values_list("group_id", flat=True)
    )
    group_ids |= set(
        GroupLink.objects.filter(
            linked_type=GroupLink.LinkedType.commit,
            linked_id__in=ReleaseCommit.objects.filter(release=release).values_list(
                "commit_id", flat=True
            ),
        ).values_list("group_id", flat=True)
    )
    return group_ids


def ensure_access_to_release_projects(request: Request, release: Release) -> None:
    """
    A release is shared by every project it is attached to, so changing it through one
    project changes it for all of them. Projects that are not active are skipped, since
    no one has access to them.
    """
    projects = release.projects.filter(status=ObjectStatus.ACTIVE)
    if not request.access.has_projects_access(projects):
        raise PermissionDenied("This release belongs to projects you do not have access to.")
