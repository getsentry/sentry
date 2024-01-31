from __future__ import annotations

from unittest.mock import patch

import pytest

from sentry.api.bases.user import (
    RegionSiloUserEndpoint,
    UserAndStaffPermission,
    UserEndpoint,
    UserPermission,
)
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.auth.staff import is_active_staff
from sentry.testutils.cases import DRFPermissionTestCase
from sentry.testutils.silo import all_silo_test, control_silo_test, region_silo_test


@all_silo_test
class UserPermissionTest(DRFPermissionTestCase):
    user_permission = UserPermission()

    def setUp(self):
        super().setUp()
        self.normal_user = self.create_user()

    def test_allows_none_user_as_anonymous(self):
        assert self.user_permission.has_object_permission(self.make_request(), None, None)

    def test_allows_current_user(self):
        assert self.user_permission.has_object_permission(
            self.make_request(self.normal_user), None, self.normal_user
        )

    def test_allows_active_superuser(self):
        # The user passed in and the user on the request must be different to
        # check superuser.
        assert self.user_permission.has_object_permission(
            self.superuser_request, None, self.normal_user
        )

    def test_rejects_active_staff(self):
        # The user passed in and the user on the request must be different to
        # check staff.
        assert not self.user_permission.has_object_permission(
            self.staff_request, None, self.normal_user
        )

    def test_rejects_user_as_anonymous(self):
        assert not self.user_permission.has_object_permission(
            self.make_request(), None, self.normal_user
        )

    def test_rejects_other_user(self):
        other_user = self.create_user()
        assert not self.user_permission.has_object_permission(
            self.make_request(self.staff_user), None, other_user
        )


@all_silo_test
class UserAndStaffPermissionTest(DRFPermissionTestCase):
    @patch("sentry.api.permissions.is_active_staff", wraps=is_active_staff)
    def test_allows_active_staff(self, mock_is_active_staff):
        # The user passed in and the user on the request must be different to
        # check staff.
        assert UserAndStaffPermission().has_object_permission(
            self.staff_request, None, self.create_user()
        )
        # Ensure we failed the UserPermission check and check is_active_staff
        assert mock_is_active_staff.call_count == 1


class BaseUserEndpointTest(DRFPermissionTestCase):
    endpoint: RegionSiloUserEndpoint | UserEndpoint = UserEndpoint()

    def test_retrieves_me_anonymous(self):
        with pytest.raises(ResourceDoesNotExist):
            self.endpoint.convert_args(self.make_request(), user_id="me")

    def test_retrieves_me(self):
        user = self.create_user()
        _, kwargs = self.endpoint.convert_args(self.make_request(user), user_id="me")
        assert kwargs["user"].id == user.id

    def test_retrieves_user_id(self):
        user = self.create_user()
        _, kwargs = self.endpoint.convert_args(self.make_request(user), user_id=user.id)
        assert kwargs["user"].id == user.id


@control_silo_test
class UserEndpointTest(BaseUserEndpointTest):
    endpoint = UserEndpoint()


@region_silo_test
class RegionSiloUserEndpointTest(BaseUserEndpointTest):
    endpoint = RegionSiloUserEndpoint()
