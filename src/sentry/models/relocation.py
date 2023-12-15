from __future__ import annotations

from enum import Enum, unique
from uuid import uuid4

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, region_silo_only_model
from sentry.db.models.base import DefaultFieldsModel, sane_repr
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.db.models.fields.uuid import UUIDField


def default_guid():
    return uuid4().hex


@region_silo_only_model
class Relocation(DefaultFieldsModel):
    """
    Represents a single relocation instance. The relocation may be attempted multiple times, but we
    keep a mapping of 1 `Relocation` model per file upload.
    """

    __relocation_scope__ = RelocationScope.Excluded
    __relocation_dependencies__ = {"sentry.User"}

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

        # Like `get_choices` above, except it excludes the final `COMPLETED` step.
        @classmethod
        def get_in_progress_choices(cls) -> list[tuple[int, str]]:
            return [(key.value, key.name) for key in cls if key.name != "COMPLETED"]

        @classmethod
        def max_value(cls):
            return max(item.value for item in cls)

    class Status(Enum):
        IN_PROGRESS = 0
        FAILURE = 1
        SUCCESS = 2
        PAUSE = 3

        # TODO(getsentry/team-ospo#190): Could we dedup this with a mixin in the future?
        @classmethod
        def get_choices(cls) -> list[tuple[int, str]]:
            return [(key.value, key.name) for key in cls]

    class EmailKind(Enum):
        STARTED = 0
        FAILED = 1
        SUCCEEDED = 2

        # TODO(getsentry/team-ospo#190): Could we dedup this with a mixin in the future?
        @classmethod
        def get_choices(cls) -> list[tuple[int, str]]:
            return [(key.value, key.name) for key in cls]

    # The user that requested this relocation - if the request was made by an admin on behalf of a
    # user, this will be different from `owner`. Otherwise, they are identical.
    creator_id = BoundedBigIntegerField()

    # The user that will be marked as the `owner` of this relocation. This is subtly different from
    # the `creator` - anyone with superuser privileges can create a new relocation, but it must
    # always be assigned to some user who will be responsible for it (ex: will become a global admin
    # for all newly imported orgs, will receive emails with status updates as the relocation
    # progresses, etc) over its lifetime and once it is completed.
    owner_id = BoundedBigIntegerField()

    # Unique ID for this import attempt. All assembled files in the remote filestore will be in a
    # directory named after this UUID.
    uuid = UUIDField(db_index=True, unique=True, default=default_guid)

    # Possible values are in the the Stage enum.
    step = models.SmallIntegerField(choices=Step.get_choices(), default=None)

    # Possible values are in the the Status enum.
    status = models.SmallIntegerField(
        choices=Status.get_choices(), default=Status.IN_PROGRESS.value
    )

    # Schedules a pause prior to some step that has not yet occurred. Useful to perform an orderly
    # halting of the relocation. When unpausing, the unpausing process is responsible for scheduling
    # the correct celery task so that the relocation may continue.
    scheduled_pause_at_step = models.SmallIntegerField(
        choices=Step.get_in_progress_choices(), null=True, default=None
    )

    # Schedules the termination of this relocation prior to some step that has not yet occurred.
    scheduled_cancel_at_step = models.SmallIntegerField(
        choices=Step.get_in_progress_choices(), null=True, default=None
    )

    # Organizations, identified by slug, which this relocation seeks to import, specified by the
    # user as part of their relocation request. These slugs are relative to the import file, not
    # their final value post-import, which may be changed to avoid collisions.
    want_org_slugs = models.JSONField(default=list)

    # Users, identified by username, which this relocation seeks to import - picked directly from
    # the raw JSON file submitted by the user. These usernames are relative to the import file, not
    # their final value post-import, which may be changed to avoid collisions.
    want_usernames = models.JSONField(null=True)

    # The last status for which we have notified the user. It is `None` by default, to indicate that
    # we have not yet sent the user a "your relocation is in progress" email.
    latest_notified = models.SmallIntegerField(
        choices=EmailKind.get_choices(), null=True, default=None
    )

    # The last time we've sent the "claim your account" email blast to all unclaimed users.
    latest_unclaimed_emails_sent_at = models.DateTimeField(null=True, default=None)

    # The last task started by this relocation. Because tasks for a given relocation are always
    # attempted sequentially, and never in concurrently (that is, there is always at most one task
    # per relocation running at a given time), we can be sure that this is globally accurate.
    latest_task = models.CharField(max_length=64, default="")

    # Number of attempts by the latest task.
    latest_task_attempts = models.SmallIntegerField(default=0)

    # If the relocation failed, provide a user-legible reason why that happened.
    failure_reason = models.CharField(max_length=256, null=True, default=None)

    __repr__ = sane_repr("owner", "uuid")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_relocation"
        constraints = [
            models.CheckConstraint(
                name="scheduled_pause_at_step_greater_than_current_step",
                check=models.Q(scheduled_pause_at_step__gt=models.F("step"))
                | models.Q(scheduled_pause_at_step__isnull=True),
            ),
            models.CheckConstraint(
                name="scheduled_cancel_at_step_greater_than_current_step",
                check=models.Q(scheduled_cancel_at_step__gt=models.F("step"))
                | models.Q(scheduled_cancel_at_step__isnull=True),
            ),
        ]


@region_silo_only_model
class RelocationFile(DefaultFieldsModel):
    """
    A `RelocationFile` is an association between a `Relocation` and a `File`.

    This model should be created in an atomic transaction with the `Relocation` and `File` it points
    to.
    """

    __relocation_scope__ = RelocationScope.Excluded

    # Several different kinds of encrypted JSON files can be created during the `Relocation`
    # process. This enum allows us to identify which file we're currently handling.
    class Kind(Enum):
        UNKNOWN = 0
        # The raw (hopefully encrypted!) export tarball that the user has provided us.
        RAW_USER_DATA = 1
        # A normalized version of the user data.
        #
        # TODO(getsentry/team-ospo#216): Add a normalization step to the relocation flow
        NORMALIZED_USER_DATA = 2
        # (Deprecated) The global configuration we're going to validate against - pulled from the
        # live Sentry instance, not supplied by the user.
        #
        # TODO(getsentry/team-ospo#216): Deprecated, since we no longer store these in main bucket.
        # Remove in the future.
        BASELINE_CONFIG_VALIDATION_DATA = 3
        # (Deprecated) The colliding users we're going to validate against - pulled from the live
        # Sentry instance, not supplied by the user. However, to determine what is a "colliding
        # user", we must inspect the user-provided data.
        #
        # TODO(getsentry/team-ospo#216): Deprecated, since we no longer store these in main bucket.
        # Remove in the future.
        COLLIDING_USERS_VALIDATION_DATA = 4

        # TODO(getsentry/team-ospo#190): Could we dedup this with a mixin in the future?
        @classmethod
        def get_choices(cls) -> list[tuple[int, str]]:
            return [(key.value, key.name) for key in cls]

        def __str__(self):
            if self.name == "RAW_USER_DATA":
                return "raw-relocation-data"
            elif self.name == "NORMALIZED_USER_DATA":
                return "normalized-relocation-data"
            elif self.name == "BASELINE_CONFIG_VALIDATION_DATA":
                return "baseline-config"
            elif self.name == "COLLIDING_USERS_VALIDATION_DATA":
                return "colliding-users"
            else:
                raise ValueError("Cannot extract a filename from `RelocationFile.Kind.UNKNOWN`.")

        def to_filename(self, ext: str):
            return str(self) + "." + ext

    relocation = FlexibleForeignKey("sentry.Relocation")
    file = FlexibleForeignKey("sentry.File")
    kind = models.SmallIntegerField(choices=Kind.get_choices())

    __repr__ = sane_repr("relocation", "file")

    class Meta:
        unique_together = (("relocation", "file"),)
        app_label = "sentry"
        db_table = "sentry_relocationfile"


@unique
class ValidationStatus(Enum):
    """
    The statuses here are ordered numerically by completeness: `TIMEOUT` is more definite than
    `IN_PROGRESS`, `FAILURE` is more definite than `TIMEOUT`, and so on. If a
    `RelocationValidationAttempt` resolves with a `ValidationStatus` greater than the one already on
    its owning `RelocationValidation`, the new `ValidationStatus` should replace the old.
    """

    # The validation operation is currently ongoing.
    IN_PROGRESS = 0
    # The validation operation did not resolve in the allotted time.
    TIMEOUT = 1
    # The validation operation could not be completed due to an internal error.
    FAILURE = 2
    # The validation operation finished, but produced findings confirming that it is invalid.
    INVALID = 3
    # The validation operation finished and produced no findings, which means that it is valid.
    VALID = 4

    # TODO(getsentry/team-ospo#190): Could we dedup this with a mixin in the future?
    @classmethod
    def get_choices(cls) -> list[tuple[int, str]]:
        return [(key.value, key.name) for key in cls]


@region_silo_only_model
class RelocationValidation(DefaultFieldsModel):
    """
    Stores general information about whether or not the associated `Relocation` passed its
    validation run.

    This model essentially unifies the possibly multiple `RelocationValidationAttempt`s that
    represent individual validation runs.
    """

    __relocation_scope__ = RelocationScope.Excluded

    relocation = FlexibleForeignKey("sentry.Relocation")

    # Possible values are in the the `ValidationStatus` enum. Shows the best result from all of the
    # `RelocationValidationAttempt`s associated with this model.
    status = status = models.SmallIntegerField(
        choices=ValidationStatus.get_choices(), default=ValidationStatus.IN_PROGRESS.value
    )

    # Number of attempts that have already started.
    attempts = models.SmallIntegerField(default=0)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_relocationvalidation"


@region_silo_only_model
class RelocationValidationAttempt(DefaultFieldsModel):
    """
    Represents a single Google CloudBuild validation run invocation, and tracks it over its
    lifetime.
    """

    __relocation_scope__ = RelocationScope.Excluded

    relocation = FlexibleForeignKey("sentry.Relocation")
    relocation_validation = FlexibleForeignKey("sentry.RelocationValidation")

    # Possible values are in the the `ValidationStatus` enum.
    status = status = models.SmallIntegerField(
        choices=ValidationStatus.get_choices(), default=ValidationStatus.IN_PROGRESS.value
    )

    # Unique build ID generated by CloudBuild for this import attempt.
    build_id = UUIDField(db_index=True, unique=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_relocationvalidationattempt"
