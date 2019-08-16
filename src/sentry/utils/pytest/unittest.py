from __future__ import absolute_import

import pytest


@pytest.fixture(scope="function")
def factories_class(
    request,
    default_user,
    default_organization,
    default_team,
    default_project,
    default_projectkey,
    default_environment,
    default_group,
    default_event,
    default_activity,
):
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
def session_class(request, session):
    request.cls.session = session
