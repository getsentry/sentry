from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from django.contrib.sessions.backends.base import SessionBase

if TYPE_CHECKING:
    from sentry.models.activity import Activity
    from sentry.models.environment import Environment
    from sentry.models.group import Group
    from sentry.models.organization import Organization
    from sentry.models.project import Project
    from sentry.models.projectkey import ProjectKey
    from sentry.models.team import Team
    from sentry.services.eventstore.models import GroupEvent
    from sentry.users.models.user import User


@pytest.fixture(scope="function")
def factories_class(
    request: pytest.FixtureRequest,
    default_user: User,
    default_organization: Organization,
    default_team: Team,
    default_project: Project,
    default_projectkey: ProjectKey,
    default_environment: Environment,
    default_group: Group,
    default_event: GroupEvent,
    default_activity: Activity,
) -> None:
    # set a class attribute on the invoking test context
    request.cls.user = default_user
    request.cls.organization = default_organization
    request.cls.team = default_team
    request.cls.project = default_project
    request.cls.projectkey = default_projectkey
    request.cls.environment = default_environment
    request.cls.group = default_group
    request.cls.event = default_event
    request.cls.activity = default_activity


@pytest.fixture(scope="function")
def session_class(request: pytest.FixtureRequest, session: SessionBase) -> None:
    request.cls.session = session
