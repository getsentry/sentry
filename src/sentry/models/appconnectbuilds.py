"""Database models to keep track of the App Store Connect builds for a project.

If a project enables the App Store Connect source to download dSYMs directly from Apple we
need to keep track of which builds have already been downloaded.
"""

from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model


class AppConnectBuild(Model):
    """A single build that exists or has existed on App Store Connect.

    Builds on App Store Connect expire, so they do disappear from the API.  This table does
    not get pruned however, once we know of a build we know of it forever.

    An individual build can be identified by the tuple of (bundle_id, platform,
    bundle_short_version, bundle_version).
    """

    __include_in_export__ = False

    project = FlexibleForeignKey("sentry.Project", db_constraint=False)

    # The integer ID of the app inside App Store Connect.
    #
    # TODO: On the AppStoreConnect API this is a str field, it was a mistake to make this
    #    int.
    app_id = models.IntegerField()

    # The unique Bundle ID, like a slug for app_id
    #
    # Normally in the shape of "io.sentry.sample.iOS-Swift"
    bundle_id = models.CharField(max_length=256)

    # The platform for this build.
    #
    # This is an Apple internal platform identifier which is not obviously translatable to
    # something like "iOS" or "watchOS", though they kind of are that.
    platform = models.CharField(max_length=256)

    # The bundle version string.
    #
    # This is the string that users will actually see, e.g. "7.2.0".  Multiple builds are
    # allowed to share this.
    bundle_short_version = models.CharField(max_length=256)

    # Also known as the build version to normal humans.
    bundle_version = models.CharField(max_length=256)

    # Whether we already fetched the dSYMs for this build.
    fetched = models.BooleanField(default=False)

    # When the build was uploaded to AppStore.
    uploaded_to_appstore = models.DateTimeField(default=timezone.now)

    # When sentry first saw the build on AppStore Connect.
    first_seen = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "sentry_appconnectbuild"
        app_label = "sentry"
