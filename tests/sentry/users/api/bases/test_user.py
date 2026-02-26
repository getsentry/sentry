from __future__ import annotations

import pytest
from django.test import override_settings
from rest_framework.views import APIView

from sentry.api.exceptions import ResourceDoesNotExist
from sentry.testutils.cases import DRFPermissionTestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import all_silo_test, control_silo_test, no_silo_test
from sentry.users.api.bases.user import (
    RegionSiloUserEndpoint,
    UserAndStaffPermission,
    UserEndpoint,
    UserPermission,
)


@all_silo_test
class UserPermissionTest(DRFPermissionTestCase):
    user_permission = UserPermission()

    def setUp(self) -> None:
        super().setUp()
        self.normal_user = self.create_user()

    def test_allows_none_user_as_anonymous(self) -> None:
        assert self.user_permission.has_object_permission(self.make_request(), APIView(), None)

    def test_allows_current_user(self) -> None:
        assert self.user_permission.has_object_permission(
            self.make_request(self.normal_user), APIView(), self.normal_user
        )

    def test_allows_active_superuser(self) -> None:
        # The user passed in and the user on the request must be different to
        # check superuser.
        org = self.create_organization(owner=self.superuser)
        with self.settings(SUPERUSER_ORG_ID=org.id):
            assert self.user_permission.has_object_permission(
                self.superuser_request, APIView(), self.normal_user
            )

            with self.settings(SENTRY_SELF_HOSTED=False, SUPERUSER_ORG_ID=org.id):
                assert self.user_permission.has_object_permission(
                    self.superuser_request, APIView(), self.normal_user
                )

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_active_superuser_read(self) -> None:
        # superuser read can hit GET
        request = self.make_request(user=self.superuser, is_superuser=True, method="GET")
        org = self.create_organization(owner=self.superuser)
        with self.settings(SUPERUSER_ORG_ID=org.id):
            assert self.user_permission.has_object_permission(request, APIView(), self.normal_user)

            # superuser read cannot hit POST
            request.method = "POST"
            assert not self.user_permission.has_object_permission(
                request, APIView(), self.normal_user
            )

    @override_settings(SENTRY_SELF_HOSTED=False)
    @override_options({"superuser.read-write.ga-rollout": True})
    def test_active_superuser_write(self) -> None:
        # superuser write can hit GET
        self.add_user_permission(self.superuser, "superuser.write")
        org = self.create_organization(owner=self.superuser)

        with self.settings(SUPERUSER_ORG_ID=org.id):
            request = self.make_request(user=self.superuser, is_superuser=True, method="GET")
            assert self.user_permission.has_object_permission(request, APIView(), self.normal_user)

            # superuser write can hit POST
            request.method = "POST"
            assert self.user_permission.has_object_permission(request, APIView(), self.normal_user)

    def test_rejects_active_staff(self) -> None:
        # The user passed in and the user on the request must be different to
        # check staff.
        assert not self.user_permission.has_object_permission(
            self.staff_request, APIView(), self.normal_user
        )

    def test_rejects_user_as_anonymous(self) -> None:
        assert not self.user_permission.has_object_permission(
            self.make_request(), APIView(), self.normal_user
        )

    def test_rejects_other_user(self) -> None:
        other_user = self.create_user()
        assert not self.user_permission.has_object_permission(
            self.make_request(self.staff_user), APIView(), other_user
        )


@all_silo_test
class UserAndStaffPermissionTest(DRFPermissionTestCase):
    def test_allows_active_staff(self) -> None:
        # The user passed in and the user on the request must be different to check staff.
        assert UserAndStaffPermission().has_object_permission(
            self.staff_request, APIView(), self.create_user()
        )


class BaseUserEndpointTest(DRFPermissionTestCase):
    endpoint: RegionSiloUserEndpoint | UserEndpoint = RegionSiloUserEndpoint()

    def test_retrieves_me_anonymous(self) -> None:
        with pytest.raises(ResourceDoesNotExist):
            self.endpoint.convert_args(self.make_request(), user_id="me")

    def test_retrieves_me(self) -> None:
        user = self.create_user()
        _, kwargs = self.endpoint.convert_args(self.make_request(user), user_id="me")
        assert kwargs["user"].id == user.id

    def test_retrieves_user_id(self) -> None:
        user = self.create_user()
        _, kwargs = self.endpoint.convert_args(self.make_request(user), user_id=user.id)
        assert kwargs["user"].id == user.id


@no_silo_test
class MonolithUserEndpoint(BaseUserEndpointTest):
    endpoint = UserEndpoint()


@control_silo_test
class ControlUserEndpointTest(BaseUserEndpointTest):
    endpoint = UserEndpoint()


# TODO(HC): Delete this once region silo by default changes land
class RegionSiloUserEndpointTest(BaseUserEndpointTest):
    endpoint = RegionSiloUserEndpoint()
