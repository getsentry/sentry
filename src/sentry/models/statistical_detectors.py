from enum import Enum
from typing import Sequence, Tuple

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedIntegerField,
    Model,
    region_silo_only_model,
    sane_repr,
)


class RegressionType(Enum):
    ENDPOINT = 0
    FUNCTION = 1

    @classmethod
    def as_choices(cls) -> Sequence[Tuple[int, str]]:
        return (
            (cls.ENDPOINT.value, "endpoint"),
            (cls.FUNCTION.value, "function"),
        )


@region_silo_only_model
class RegressionGroup(Model):
    __relocation_scope__ = RelocationScope.Excluded

    # Meta data about the regression group
    date_added = models.DateTimeField(auto_now_add=True)
    date_updated = models.DateTimeField(auto_now=True)

    # When the regression started, this is the breakpoint.
    date_regressed = models.DateTimeField()

    # When the regression resolved.
    date_resolved = models.DateTimeField(null=True)

    # The version associated with the group. Each time a regression
    # is detected for the group, we increment the version.
    version = models.IntegerField()

    # Indiciates if the regression group is active or not. This should
    # be checked in conjunction with the issue group status to determine
    # the status of the group as manual status changes do not
    # propagate from the issue group to here.
    active = models.BooleanField(default=True)

    project_id = BoundedBigIntegerField(db_index=True)

    type = BoundedIntegerField(choices=RegressionType.as_choices())

    # The fingerprint sent to the issue platform which
    # accepts a list of strings. This corresponds to the
    # first string which is a 8-16 char hex value.
    # Here, it's being stored as it's integer equivalent.
    fingerprint = BoundedBigIntegerField()

    # The value measured from before the regression.
    baseline = models.FloatField()

    # The value measured from after the regression.
    regressed = models.FloatField()

    class Meta:
        index_together = (("type", "project_id", "fingerprint", "active"),)
        unique_together = (("type", "project_id", "fingerprint", "version"),)

    __repr__ = sane_repr("active", "version", "type", "project_id", "fingerprint")
