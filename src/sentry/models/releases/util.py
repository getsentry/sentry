from __future__ import annotations

import logging
from collections.abc import Mapping

from django.db.models import F, Func, Sum
from django.db.models.signals import pre_save

from sentry.models.release import Release, ReleaseQuerySet
from sentry.utils.cache import cache
from sentry.utils.hashlib import hash_values

logger = logging.getLogger(__name__)


def get_artifact_counts(release_ids: list[int]) -> Mapping[int, int]:
    """Get artifact count grouped by IDs"""
    from sentry.models.releasefile import ReleaseFile

    qs = (
        ReleaseFile.objects.filter(release_id__in=release_ids)
        .annotate(count=Sum(Func(F("artifact_count"), 1, function="COALESCE")))
        .values_list("release_id", "count")
    )
    qs.query.group_by = ["release_id"]
    return dict(qs)


def follows_semver_versioning_scheme(org_id, project_id, release_version=None):
    """
    Checks if we should follow semantic versioning scheme for ordering based on
    1. Latest ten releases of the project_id passed in all follow semver
    2. provided release version argument is a valid semver version

    Inputs:
        * org_id
        * project_id
        * release_version
    Returns:
        Boolean that indicates if we should follow semantic version or not
    """
    # ToDo(ahmed): Move this function else where to be easily accessible for re-use
    cache_key = "follows_semver:1:%s" % hash_values([org_id, project_id])
    follows_semver = cache.get(cache_key)

    if follows_semver is None:
        # Check if the latest ten releases are semver compliant
        releases_list = list(
            Release.objects.filter(organization_id=org_id, projects__id__in=[project_id])
            .using_replica()
            .order_by("-date_added")[:10]
        )

        if not releases_list:
            cache.set(cache_key, False, 3600)
            return False

        # ToDo(ahmed): re-visit/replace these conditions once we enable project wide `semver` setting
        # A project is said to be following semver versioning schemes if it satisfies the following
        # conditions:-
        # 1: At least one semver compliant in the most recent 3 releases
        # 2: At least 3 semver compliant releases in the most recent 10 releases
        if len(releases_list) <= 2:
            # Most recent release is considered to decide if project follows semver
            follows_semver = releases_list[0].is_semver_release
        elif len(releases_list) < 10:
            # We forego condition 2 and it is enough if condition 1 is satisfied to consider this
            # project to have semver compliant releases
            follows_semver = any(release.is_semver_release for release in releases_list[0:3])
        else:
            # Count number of semver releases in the last ten
            semver_matches = sum(map(lambda release: release.is_semver_release, releases_list))

            at_least_three_in_last_ten = semver_matches >= 3
            at_least_one_in_last_three = any(
                release.is_semver_release for release in releases_list[0:3]
            )

            follows_semver = at_least_one_in_last_three and at_least_three_in_last_ten
        cache.set(cache_key, follows_semver, 3600)

    # Check release_version that is passed is semver compliant
    if release_version:
        follows_semver = follows_semver and Release.is_semver_version(release_version)
    return follows_semver


def parse_semver_pre_save(instance, **kwargs):
    if instance.id:
        return
    ReleaseQuerySet.massage_semver_cols_into_release_object_data(instance.__dict__)


pre_save.connect(
    parse_semver_pre_save, sender="sentry.Release", dispatch_uid="parse_semver_pre_save"
)
