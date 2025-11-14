from typing import int, ContextManager

from rest_framework.views import APIView

from sentry.issues.endpoints.bases.group import GroupAiEndpoint, GroupAiPermission
from sentry.models.apitoken import ApiToken
from sentry.models.group import Group
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.requests import drf_request_from_request
from sentry.users.models.user import User


class GroupAiPermissionTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.permission = GroupAiPermission()
        self.project = self.create_project()
        self.group = self.create_group(project=self.project)
        self.demo_user = self.create_user()

    def _demo_mode_enabled(self) -> ContextManager[None]:
        return override_options({"demo-mode.enabled": True, "demo-mode.users": [self.demo_user.id]})

    def has_object_perm(
        self,
        method: str,
        obj: Group,
        auth: ApiToken | None = None,
        user: User | None = None,
        is_superuser: bool | None = None,
    ) -> bool:
        request = self.make_request(user=user, auth=auth, method=method, is_superuser=is_superuser)
        drf_request = drf_request_from_request(request)
        return self.permission.has_permission(
            drf_request, APIView()
        ) and self.permission.has_object_permission(drf_request, APIView(), obj)

    def test_demo_user_safe_methods(self) -> None:
        with self._demo_mode_enabled():
            for method in ("GET", "HEAD", "OPTIONS"):
                assert self.has_object_perm(method, self.group, user=self.demo_user)

    def test_demo_user_post_allowed(self) -> None:
        with self._demo_mode_enabled():
            assert self.has_object_perm("POST", self.group, user=self.demo_user)

    def test_demo_user_unsafe_methods_blocked(self) -> None:
        with self._demo_mode_enabled():
            for method in ("PUT", "DELETE", "PATCH"):
                assert not self.has_object_perm(method, self.group, user=self.demo_user)

    def test_demo_user_demo_mode_disabled(self) -> None:
        for method in ("GET", "POST", "PUT", "DELETE"):
            assert not self.has_object_perm(method, self.group, user=self.demo_user)

    def test_regular_user_with_access(self) -> None:
        user = self.create_user()
        self.create_member(
            user=user,
            organization=self.project.organization,
            role="member",
            teams=[self.project.teams.first()],
        )

        assert self.has_object_perm("GET", self.group, user=user)
        assert self.has_object_perm("POST", self.group, user=user)
        assert self.has_object_perm("DELETE", self.group, user=user)

    def test_superuser_access(self) -> None:
        superuser = self.create_user(is_superuser=True)

        for method in ("GET", "POST", "PUT", "DELETE"):
            assert self.has_object_perm(method, self.group, user=superuser, is_superuser=True)


class GroupAiEndpointTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.endpoint = GroupAiEndpoint()
        self.project = self.create_project()
        self.group = self.create_group(project=self.project)

    def test_permission_classes(self) -> None:
        assert hasattr(self.endpoint, "permission_classes")
        assert self.endpoint.permission_classes == (GroupAiPermission,)
