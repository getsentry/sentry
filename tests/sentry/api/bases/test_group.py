from rest_framework.views import APIView

from sentry.api.bases.group import GroupAiEndpoint, GroupAiPermission
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.requests import drf_request_from_request

DEMO_USER_ID = 2


class GroupAiPermissionTest(TestCase):
    def setUp(self):
        super().setUp()
        self.permission = GroupAiPermission()
        self.project = self.create_project()
        self.group = self.create_group(project=self.project)

    def has_object_perm(self, method, obj, auth=None, user=None, is_superuser=None):
        request = self.make_request(user=user, auth=auth, method=method, is_superuser=is_superuser)
        drf_request = drf_request_from_request(request)
        return self.permission.has_permission(
            drf_request, APIView()
        ) and self.permission.has_object_permission(drf_request, APIView(), obj)

    @override_options({"demo-mode.enabled": True, "demo-mode.users": [DEMO_USER_ID]})
    def test_demo_user_safe_methods(self):
        demo_user = self.create_user(id=DEMO_USER_ID)

        for method in ("GET", "HEAD", "OPTIONS"):
            assert self.has_object_perm(method, self.group, user=demo_user)

    @override_options({"demo-mode.enabled": True, "demo-mode.users": [DEMO_USER_ID]})
    def test_demo_user_post_allowed(self):
        demo_user = self.create_user(id=DEMO_USER_ID)
        assert self.has_object_perm("POST", self.group, user=demo_user)

    @override_options({"demo-mode.enabled": True, "demo-mode.users": [DEMO_USER_ID]})
    def test_demo_user_unsafe_methods_blocked(self):
        demo_user = self.create_user(id=DEMO_USER_ID)

        for method in ("PUT", "DELETE", "PATCH"):
            assert not self.has_object_perm(method, self.group, user=demo_user)

    @override_options({"demo-mode.enabled": False, "demo-mode.users": [DEMO_USER_ID]})
    def test_demo_user_demo_mode_disabled(self):
        demo_user = self.create_user(id=DEMO_USER_ID)

        for method in ("GET", "POST", "PUT", "DELETE"):
            assert not self.has_object_perm(method, self.group, user=demo_user)

    def test_regular_user_with_access(self):
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

    def test_superuser_access(self):
        superuser = self.create_user(is_superuser=True)

        for method in ("GET", "POST", "PUT", "DELETE"):
            assert self.has_object_perm(method, self.group, user=superuser, is_superuser=True)


class GroupAiEndpointTest(TestCase):
    def setUp(self):
        super().setUp()
        self.endpoint = GroupAiEndpoint()
        self.project = self.create_project()
        self.group = self.create_group(project=self.project)

    def test_permission_classes(self):
        assert GroupAiPermission in self.endpoint.permission_classes
