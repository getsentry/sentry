from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Sequence

from sentry.models.group import Group, GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.types.activity import ActivityType

logger = logging.getLogger(__name__)


class StatusChangeMessageData:
    fingerprint: Sequence[str]
    project_id: int
    new_status: int
    new_substatus: int | None


@dataclass(frozen=True)
class StatusChangeMessage:
    fingerprint: Sequence[str]
    project_id: int
    new_status: int
    new_substatus: int | None

    def to_dict(
        self,
    ) -> StatusChangeMessageData:
        return {
            "fingerprint": self.fingerprint,
            "project_id": self.project_id,
            "new_status": self.new_status,
            "new_substatus": self.new_substatus,
        }

    def update_status(self, group):
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

    def get_group_from_fingerprint(self):
        grouphash = (
            GroupHash.objects.filter(
                project=self.project_id,
                hash=self.fingerprint[0],
            )
            .select_related("group")
            .first()
        )
        if not grouphash:
            logger.error(
                "grouphash.not_found",
                extra={
                    "project_id": self.project_id,
                    "fingerprint": self.fingerprint,
                },
            )
            return

        return grouphash.group
