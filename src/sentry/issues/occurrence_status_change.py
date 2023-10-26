from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Sequence

from sentry.models.group import Group, GroupStatus
from sentry.types.activity import ActivityType
from sentry.types.group import IGNORED_SUBSTATUS_CHOICES, GroupSubStatus

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OccurrenceStatusChange:
    fingerprint: Sequence[str]
    project_id: int
    new_status: int
    new_substatus: int | None

    def update_status_for_occurrence(self, group):
        if group.status == self.new_status and group.substatus == self.new_substatus:
            return

        log_extra = {
            "project_id": self.project_id,
            "fingerprint": self.fingerprint,
            "new_status": self.new_status,
            "new_substatus": self.new_substatus,
        }

        # Validate the provided status and substatus - we only allow setting a substatus for unresolved or ignored groups.
        if self.new_status in [GroupStatus.UNRESOLVED, GroupStatus.IGNORED]:
            if self.new_substatus is None:
                logger.error(
                    "group.update_status.missing_substatus",
                    extra={**log_extra},
                )
                return
        else:
            if self.new_substatus is not None:
                logger.error(
                    "group.update_status.unexpected_substatus",
                    extra={**log_extra},
                )
                return

        if self.new_status == GroupStatus.RESOLVED:
            Group.objects.update_group_status(
                groups=[group],
                status=self.new_status,
                substatus=self.new_substatus,
                activity_type=ActivityType.SET_RESOLVED,
            )
        elif self.new_status == GroupStatus.IGNORED:
            # The IGNORED status supports 3 substatuses. For UNTIL_ESCALATING and
            # UNTIL_CONDITION_MET, we expect the caller to monitor the conditions/escalating
            # logic and call the API with the new status when the conditions change.
            if self.new_substatus not in IGNORED_SUBSTATUS_CHOICES:
                logger.error(
                    "group.update_status.invalid_substatus",
                    extra={**log_extra},
                )
                return

            Group.objects.update_group_status(
                groups=[group],
                status=self.new_status,
                substatus=self.new_substatus,
                activity_type=ActivityType.SET_IGNORED,
            )
        elif self.new_status == GroupStatus.UNRESOLVED:
            activity_type = None
            if self.new_substatus == GroupSubStatus.ESCALATING:
                activity_type = ActivityType.SET_ESCALATING
            elif self.new_substatus == GroupSubStatus.REGRESSED:
                activity_type = ActivityType.SET_REGRESSION
            elif self.new_substatus == GroupSubStatus.ONGOING:
                activity_type = ActivityType.SET_UNRESOLVED

            # We don't support setting the UNRESOLVED status with substatus NEW -
            # this is automatically set on creation and all other issues should be set to ONGOING.
            if activity_type is None:
                logger.error(
                    "group.update_status.invalid_substatus",
                    extra={**log_extra},
                )
                return

            Group.objects.update_group_status(
                groups=[group],
                status=self.new_status,
                substatus=self.new_substatus,
                activity_type=activity_type,
            )
        else:
            raise NotImplementedError(f"Unsupported status: {self.new_status} {self.new_substatus}")
