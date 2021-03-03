from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import GroupLink, GroupResolution, Release, ReleaseCommit


def get_group_ids_resolved_in_release(organization, version):
    try:
        release = Release.objects.get(version=version, organization=organization)
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
