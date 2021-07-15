from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _
from sentry_relay import RelayError, parse_release
from sentry_relay.processing import compare_version as compare_version_relay

from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
from sentry.models.release import DB_VERSION_LENGTH, follows_semver_versioning_scheme


class GroupResolution(Model):
    """
    Describes when a group was marked as resolved.
    """

    __include_in_export__ = False

    class Type:
        in_release = 0
        in_next_release = 1

    class Status:
        pending = 0
        resolved = 1

    group = FlexibleForeignKey("sentry.Group", unique=True)
    # the release in which its suggested this was resolved
    # which allows us to indicate if it still happens in newer versions
    release = FlexibleForeignKey("sentry.Release")
    # This release field represents the release version of the bug when the user clicked on the
    # "resolve in next release" button
    # This column is specifically added for semver release comparison to be able to compare this
    # semver release against "future/resolved" semver releases
    current_release_version = models.CharField(max_length=DB_VERSION_LENGTH, null=True, blank=True)
    type = BoundedPositiveIntegerField(
        choices=((Type.in_next_release, "in_next_release"), (Type.in_release, "in_release")),
        null=True,
    )
    actor_id = BoundedPositiveIntegerField(null=True)
    datetime = models.DateTimeField(default=timezone.now, db_index=True)
    status = BoundedPositiveIntegerField(
        default=Status.pending,
        choices=((Status.pending, _("Pending")), (Status.resolved, _("Resolved"))),
    )

    class Meta:
        db_table = "sentry_groupresolution"
        app_label = "sentry"

    __repr__ = sane_repr("group_id", "release_id")

    @classmethod
    def has_resolution(cls, group, release):
        """
        Determine if a resolution exists for the given group and release.

        This is used to suggest if a regression has occurred.
        """
        try:
            res_type, res_release, res_release_datetime, current_release_version = (
                cls.objects.filter(group=group)
                .select_related("release")
                .values_list(
                    "type", "release__id", "release__date_added", "current_release_version"
                )[0]
            )
        except IndexError:
            return False

        # if no release is present, we assume we've gone from "no release" to "some release"
        # in application configuration, and thus this must be older
        if not release:
            return True

        if res_type in (None, cls.Type.in_next_release):
            # If current_release_version was set, it means we are probably using semver since
            # current_release_version is only set after checking that the project is following
            # semver versioning scheme
            if current_release_version:
                follows_semver = follows_semver_versioning_scheme(
                    project_id=group.project.id,
                    org_id=group.organization.id,
                    release_version=release.version,
                )
                # However even though we are almost sure that we are following semver, we need to
                # check once more to ensure that both the release version passed follows semver
                # and that the user did not stop using semver
                if follows_semver:
                    try:
                        # If current_release_version == release.version => 0
                        # If current_release_version < release.version => -1
                        # If current_release_version > release.version => 1
                        current_release_raw = parse_release(current_release_version).get(
                            "version_raw"
                        )
                        release_raw = parse_release(release.version).get("version_raw")
                        return compare_version_relay(current_release_raw, release_raw) == -1
                    except RelayError:
                        ...

            # ID check and Date also act as fallback in case compare_versions that compares
            # semver releases fail
            # This should never happen though because it is ensures that current_release_version
            # follows semver when it is set, and we check if release.version follows semver
            if res_release == release.id:
                return True
            elif res_release_datetime > release.date_added:
                return True
            return False
        elif res_type == cls.Type.in_release:
            if res_release == release.id:
                return False
            if res_release_datetime < release.date_added:
                return False
            return True
        else:
            raise NotImplementedError
