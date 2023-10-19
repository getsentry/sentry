from __future__ import annotations

import logging
from enum import Enum
from uuid import uuid4

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import CharField, region_silo_only_model
from sentry.db.models.base import DefaultFieldsModel, sane_repr
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base import BaseManager

logger = logging.getLogger(__name__)


def default_guid():
    return uuid4().hex


@region_silo_only_model
class Relocation(DefaultFieldsModel):
    """
    Represents a single relocation instance. The relocation may be attempted multiple times, but we keep a mapping of 1 `Relocation` model per file upload.
    """

    __relocation_scope__ = RelocationScope.Excluded

    # The last stage this relocation reached. If the `Status` is `IN_PROGRESS`, the relocation is
    # still active; otherwise, this can be considered the terminal stage.
    class Step(Enum):
        UNKNOWN = 0
        # The upload of the underlying data has been initiated, though it is not necessarily the
        # case that it will be fully replicated on the filestore when queried.
        UPLOADING = 1
        # The data is being preprocessed.
        PREPROCESSING = 2
        # Validation is in progress.
        VALIDATING = 3
        # Import onto the production server is in progress.
        IMPORTING = 4
        # Postprocessing is being performed on a finished import.
        POSTPROCESSING = 5
        # Emails are being sent out to the relevant imported parties.
        NOTIFYING = 6
        # The import was successfully completed.
        COMPLETED = 7

        # TODO(getsentry/team-ospo#190): Could we dedup this with a mixin in the future?
        @classmethod
        def get_choices(cls) -> list[tuple[int, str]]:
            return [(key.value, key.name) for key in cls]

    class Status(Enum):
        IN_PROGRESS = 0
        FAILURE = 1
        SUCCESS = 2

        # TODO(getsentry/team-ospo#190): Could we dedup this with a mixin in the future?
        @classmethod
        def get_choices(cls) -> list[tuple[int, str]]:
            return [(key.value, key.name) for key in cls]

    # The user that requested this relocation - if null, it was done by an admin.
    creator = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")

    # The user that will be marked as the `owner` of this relocation. This is subtly different from
    # the `creator` - anyone with superuser privileges can create a new relocation, but it must
    # always be assigned to some user who will be responsible for it (ex: will become a global admin
    # for all newly imported orgs, will receive emails with status updates as the relocation
    # progresses, etc) over its lifetime and once it is completed.
    #
    # This is left NULL because we want to retain the ability to audit and rollback a `Relocation`
    # even in the (unlikely) event of an admin account being deleted, but that `NULL` should never
    # be set at creation time.
    owner = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")

    # Unique ID for this import attempt. This can also be used as the name of
    # the import blob in Google Cloud Storage.
    uuid = CharField(max_length=32, unique=True, default=default_guid)

    # Possible values are in the the Stage enum.
    step = models.SmallIntegerField(choices=Step.get_choices(), default=None)

    # Possible values are in the the Status enum.
    status = models.SmallIntegerField(
        choices=Status.get_choices(), default=Status.IN_PROGRESS.value
    )

    # Organizations, identified by slug, which this relocation seeks to import - picked directly
    # from the raw JSON file submitted by the user. These slugs are relative to the import file, not
    # their final value post-import, which may be changed to avoid collisions.
    want_org_slugs = models.JSONField(default=list)

    # Users, identified by username, which this relocation seeks to import - picked directly from
    # the raw JSON file submitted by the user. These usernames are relative to the import file, not
    # their final value post-import, which may be changed to avoid collisions.
    want_usernames = models.JSONField(null=True)

    # The last status for which we have notified the user. It is `None` by default, to indicate that we have not yet sent the user a "your relocation is in progress" email.
    latest_notified = models.SmallIntegerField(choices=Step.get_choices(), null=True, default=None)

    # Latest celery task the relocation reached.
    latest_task = models.CharField(max_length=64, default="")

    # Number of attempts by the latest task.
    latest_task_attempts = models.SmallIntegerField(default=0)

    # If the relocation failed, provide a user-legible reason why that happened.
    failure_reason = models.CharField(max_length=256, null=True, default=None)

    # TODO(azaslavsky): maybe remove?
    # Public key used to encrypt the JSON blob - we can match this to our
    # private key when decrypting internally. Null indicates unencrypted input.
    # public_key = CharField(null=True)

    # TODO(azaslavsky): maybe remove?
    # A SHA-1 checksum of the decrypted JSON blob the user provided us.
    # checksum = models.CharField(max_length=40)

    __repr__ = sane_repr("owner", "uuid")

    objects = BaseManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_relocation"


@region_silo_only_model
class RelocationFile(DefaultFieldsModel):
    """
    A `RelocationFile` is an association between a `Relocation` and a `File`.

    This model should be created in an atomic transaction with the `Relocation` and `File` it points
    to.
    """

    __relocation_scope__ = RelocationScope.Excluded

    # Several different kinds of JSON files can be created during the `Relocation` process. This
    # enum allows us to identify which file we're currently handling.
    class Kind(Enum):
        UNKNOWN = 0
        # The raw (hopefully encrypted!) export tarball that the user has provided us.
        RAW_USER_DATA = 1
        # A normalized version of the user data.
        # TODO(getsentry/team-ospo#203): Add a normalization step to the relocation flow
        NORMALIZED_USER_DATA = 2
        # The global configuration we're going to validate against - pulled from the live Sentry
        # instance, not supplied by the user.
        BASELINE_CONFIG_VALIDATION_DATA = 3
        # The colliding users we're going to validate against - pulled from the live Sentry
        # instance, not supplied by the user. However, to determine what is a "colliding user", we
        # must inspect the user-provided data.
        COLLIDING_USERS_VALIDATION_DATA = 4

        # TODO(getsentry/team-ospo#190): Could we dedup this with a mixin in the future?
        @classmethod
        def get_choices(cls) -> list[tuple[int, str]]:
            return [(key.value, key.name) for key in cls]

    relocation = FlexibleForeignKey("sentry.Relocation")
    file = FlexibleForeignKey("sentry.File")
    kind = models.SmallIntegerField(choices=Kind.get_choices())

    __repr__ = sane_repr("relocation", "file")

    class Meta:
        unique_together = (("relocation", "file"),)
        app_label = "sentry"
        db_table = "sentry_relocationfile"
