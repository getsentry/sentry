from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Sequence

from sentry.models.group import Group, GroupStatus
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OccurrenceStatusChange:
    fingerprint: Sequence[str]
    project_id: int
    new_status: GroupStatus
    new_substatus: GroupSubStatus | None

    def update_status_for_occurrence(self, group):
        if group.status == self.new_status and group.substatus == self.new_substatus:
            return

        # Validate the provided status and substatus - we only allow setting a substatus for unresolved or ignored groups.
        if self.new_status in [GroupStatus.UNRESOLVED, GroupStatus.IGNORED]:
            if self.new_substatus is None:
                logger.error(
                    "group.update_status.missing_substatus",
                    extra={
                        "project_id": self.project_id,
                        "fingerprint": self.fingerprint,
                        "new_status": self.new_status,
                        "new_substatus": self.new_substatus,
                    },
                )
                return
        else:
            if self.new_substatus is not None:
                logger.error(
                    "group.update_status.invalid_substatus",
                    extra={
                        "project_id": self.project_id,
                        "fingerprint": self.fingerprint,
                        "new_status": self.new_status,
                        "new_substatus": self.new_substatus,
                    },
                )
                return

        if self.new_status == GroupStatus.RESOLVED:
            Group.objects.update_group_status(
                groups=[group],
                status=self.new_status,
                substatus=self.new_substatus,
                activity_type=ActivityType.SET_RESOLVED,
            )
        else:
            raise NotImplementedError(f"Unsupported status: {self.new_status} {self.new_substatus}")
