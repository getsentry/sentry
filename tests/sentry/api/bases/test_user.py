import pytest
from rest_framework.request import Request

from sentry.api.bases.user import RegionSiloUserEndpoint, UserEndpoint, UserPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, control_silo_test, region_silo_test


@all_silo_test(stable=True)
class UserPermissionTest(TestCase):
    user_permission = UserPermission()

    def test_anonymous_no_user(self):
        request = Request(self.make_request(method="GET"))
        assert self.user_permission.has_object_permission(request, None, None)

    def test_request_user(self):
        user = self.create_user()
        request = Request(self.make_request(method="GET"))
        request.user = user
        assert self.user_permission.has_object_permission(request, None, user)

    def test_anonymous(self):
        user = self.create_user()
        request = Request(self.make_request(method="GET"))
        assert not self.user_permission.has_object_permission(request, None, user)

    def test_other(self):
        request = Request(self.make_request(method="GET"))
        request.user = self.create_user()
        assert not self.user_permission.has_object_permission(request, None, self.create_user())


@control_silo_test(stable=True)
class UserEndpointTest(TestCase):
    endpoint = UserEndpoint()

    def test_retrieves_me_anonymous(self):
        request = Request(self.make_request(method="GET"))
        with pytest.raises(ResourceDoesNotExist):
            self.endpoint.convert_args(request, user_id="me")

    def test_retrieves_me(self):
        user = self.create_user()
        request = Request(self.make_request(method="GET"))
        request.user = user
        args, kwargs = self.endpoint.convert_args(request, user_id="me")
        assert kwargs["user"].id == user.id

    def test_retrieves_user_id(self):
        user = self.create_user()
        request = Request(self.make_request(method="GET"))
        request.user = user
        args, kwargs = self.endpoint.convert_args(request, user_id=user.id)
        assert kwargs["user"].id == user.id


@region_silo_test(stable=True)
class RegionSiloUserEndpointTest(TestCase):
    endpoint = RegionSiloUserEndpoint()

    def test_retrieves_me_anonymous(self):
        request = Request(self.make_request(method="GET"))
        with pytest.raises(ResourceDoesNotExist):
            self.endpoint.convert_args(request, user_id="me")

    def test_retrieves_me(self):
        user = self.create_user()
        request = Request(self.make_request(method="GET"))
        request.user = user
        args, kwargs = self.endpoint.convert_args(request, user_id="me")
        assert kwargs["user"].id == user.id

    def test_retrieves_user_id(self):
        user = self.create_user()
        request = Request(self.make_request(method="GET"))
        request.user = user
        args, kwargs = self.endpoint.convert_args(request, user_id=user.id)
        assert kwargs["user"].id == user.id
