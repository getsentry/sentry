from typing import Any, get_args

import pytest

from sentry.constants import ObjectStatus, ObjectStatusName, SentryAppStatus, SentryAppStatusName
from sentry.models.avatars.organization_avatar import OrganizationAvatar
from sentry.models.avatars.team_avatar import TeamAvatar
from sentry.models.organizationmember import InviteStatusName, invite_status_names
from sentry.models.release import ReleaseStatus, ReleaseStatusName
from sentry.monitors.models import CheckInStatus, MonitorStatus
from sentry.monitors.serializers import CheckInStatusName, MonitorStatusName
from sentry.users.api.serializers.user import AvatarTypeName
from sentry.users.models.user_avatar import UserAvatar
from sentry.workflow_engine.endpoints.serializers.data_source_serializer import DataSourceTypeName
from sentry.workflow_engine.endpoints.serializers.workflow_serializer import (
    ActionTypeName,
    LogicTypeName,
)
from sentry.workflow_engine.models import Action, DataConditionGroup
from sentry.workflow_engine.registry import data_source_type_registry


def _labels(choices: Any) -> set[str]:
    return {label for _, label in choices}


@pytest.mark.parametrize(
    ("literal", "values"),
    [
        (ObjectStatusName, _labels(ObjectStatus.as_choices())),
        (SentryAppStatusName, _labels(SentryAppStatus.as_choices())),
        (MonitorStatusName, _labels(MonitorStatus.as_choices())),
        (CheckInStatusName, _labels(CheckInStatus.as_choices())),
        (
            ReleaseStatusName,
            {
                ReleaseStatus.to_string(ReleaseStatus.OPEN),
                ReleaseStatus.to_string(ReleaseStatus.ARCHIVED),
            },
        ),
        (InviteStatusName, set(invite_status_names.values())),
        (
            AvatarTypeName,
            _labels(UserAvatar.AVATAR_TYPES)
            | _labels(OrganizationAvatar.AVATAR_TYPES)
            | _labels(TeamAvatar.AVATAR_TYPES),
        ),
        (ActionTypeName, {t.value for t in Action.Type}),
        (LogicTypeName, {t.value for t in DataConditionGroup.Type}),
        (DataSourceTypeName, set(data_source_type_registry.registrations)),
    ],
)
def test_literal_matches_choices(literal: Any, values: set[str]) -> None:
    assert set(get_args(literal)) == values
