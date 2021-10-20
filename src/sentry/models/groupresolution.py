from django.db import models
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _
from sentry_relay import RelayError, parse_release
from sentry_relay.processing import compare_version as compare_version_relay

from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
from sentry.models.release import DB_VERSION_LENGTH, Release, follows_semver_versioning_scheme
from sentry.utils import metrics


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
    # This release field represents the latest release version associated with a group when the
    # user chooses "resolve in next release", and is set for both semver and date ordered releases
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

        def compare_release_dates_for_in_next_release(res_release, res_release_datetime, release):
            """
            Helper function that compares release versions based on date for
            `GroupResolution.Type.in_next_release`
            """
            return res_release == release.id or res_release_datetime > release.date_added

        try:
            (
                res_type,
                res_release,
                res_release_version,
                res_release_datetime,
                current_release_version,
            ) = (
                cls.objects.filter(group=group)
                .select_related("release")
                .values_list(
                    "type",
                    "release__id",
                    "release__version",
                    "release__date_added",
                    "current_release_version",
                )[0]
            )
        except IndexError:
            return False

        # if no release is present, we assume we've gone from "no release" to "some release"
        # in application configuration, and thus this must be older
        if not release:
            return True

        follows_semver = follows_semver_versioning_scheme(
            project_id=group.project.id,
            org_id=group.organization.id,
            release_version=release.version,
        )

        # if current_release_version was set, then it means that initially Group was resolved in
        # next release, which means a release will have a resolution if it is the same as
        # `current_release_version` or was released before it according to either its semver version
        # or its date. We make that decision based on whether the project follows semantic
        # versioning or not
        if current_release_version:
            if follows_semver:
                try:
                    # If current_release_version == release.version => 0
                    # If current_release_version < release.version => -1
                    # If current_release_version > release.version => 1
                    current_release_raw = parse_release(current_release_version).get("version_raw")
                    release_raw = parse_release(release.version).get("version_raw")
                    return compare_version_relay(current_release_raw, release_raw) >= 0
                except RelayError:
                    ...
            else:
                try:
                    current_release_obj = Release.objects.get(
                        organization_id=group.organization.id, version=current_release_version
                    )

                    return compare_release_dates_for_in_next_release(
                        res_release=current_release_obj.id,
                        res_release_datetime=current_release_obj.date_added,
                        release=release,
                    )
                except Release.DoesNotExist:
                    ...

        # We still fallback to the older model if either current_release_version was not set (
        # i.e. In all resolved cases except for Resolved in Next Release) or if for whatever
        # reason the semver/date checks fail (which should not happen!)
        if res_type in (None, cls.Type.in_next_release):
            # Add metric here to ensure that this code branch ever runs given that
            # clear_expired_resolutions changes the type to `in_release` once a Release instance
            # is created
            metrics.incr("groupresolution.has_resolution.in_next_release", sample_rate=1.0)

            return compare_release_dates_for_in_next_release(
                res_release=res_release, res_release_datetime=res_release_datetime, release=release
            )
        elif res_type == cls.Type.in_release:
            # If release id provided is the same as resolved release id then return False
            # regardless of whether it is a semver project or not
            if res_release == release.id:
                return False

            if follows_semver:
                try:
                    # A resolution only exists if the resolved release is greater (in semver
                    # terms) than the provided release
                    res_release_raw = parse_release(res_release_version).get("version_raw")
                    release_raw = parse_release(release.version).get("version_raw")
                    return compare_version_relay(res_release_raw, release_raw) == 1
                except RelayError:
                    ...

            # Fallback to older model if semver comparison fails due to whatever reason
            return res_release_datetime >= release.date_added
        else:
            raise NotImplementedError
