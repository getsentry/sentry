from __future__ import annotations

from unittest.mock import patch

import pytest
from django.http import HttpRequest
from rest_framework.request import Request

from sentry.api.bases.user import RegionSiloUserEndpoint, UserEndpoint, UserPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models.user import User
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.silo import all_silo_test, control_silo_test, region_silo_test


def get_request(user: User | None = None) -> Request:
    request = Request(HttpRequest())
    request.method = "GET"
    request.session = Factories.create_session()
    if user is not None:
        request.user = user
    return request


@all_silo_test
class UserPermissionTest(TestCase):
    user_permission = UserPermission()

    def test_allows_none_user_as_anonymous(self):
        assert self.user_permission.has_object_permission(get_request(), None, None)

    def test_allows_current_user(self):
        user = Factories.create_user()
        assert self.user_permission.has_object_permission(get_request(user), None, user)

    @patch("sentry.api.bases.user.is_active_superuser", return_value=True)
    def test_allows_active_superuser(self, mock_is_active_superuser):
        user = Factories.create_user(is_superuser=True, is_staff=False)
        assert self.user_permission.has_object_permission(get_request(), None, user)

    @patch("sentry.api.bases.user.is_active_staff", return_value=True)
    def test_allows_active_staff(self, mock_is_active_staff):
        user = Factories.create_user(is_staff=True, is_superuser=False)
        assert self.user_permission.has_object_permission(get_request(), None, user)

    def test_rejects_user_as_anonymous(self):
        user = Factories.create_user()
        assert not self.user_permission.has_object_permission(get_request(), None, user)

    def test_rejects_other_user(self):
        user, other = Factories.create_user(), Factories.create_user()
        assert not self.user_permission.has_object_permission(get_request(user), None, other)


class BaseUserEndpointTest:
    endpoint: RegionSiloUserEndpoint | UserEndpoint = UserEndpoint()

    def test_retrieves_me_anonymous(self):
        with pytest.raises(ResourceDoesNotExist):
            self.endpoint.convert_args(get_request(), user_id="me")

    def test_retrieves_me(self):
        user = Factories.create_user()
        args, kwargs = self.endpoint.convert_args(get_request(user), user_id="me")
        assert kwargs["user"].id == user.id

    def test_retrieves_user_id(self):
        user = Factories.create_user()
        args, kwargs = self.endpoint.convert_args(get_request(user), user_id=user.id)
        assert kwargs["user"].id == user.id


@control_silo_test
class UserEndpointTest(BaseUserEndpointTest, TestCase):
    endpoint = UserEndpoint()


@region_silo_test
class RegionSiloUserEndpointTest(BaseUserEndpointTest, TestCase):
    endpoint = RegionSiloUserEndpoint()
