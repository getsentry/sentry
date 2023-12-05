from unittest import mock

from django.urls import reverse

from sentry.models.apitoken import ApiToken
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


@region_silo_test
class ProjectGroupingConfigsPermissionsTest(APITestCase):

    endpoint = "sentry-api-0-project-grouping-configs"

    def test_permissions(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=[])
        url = reverse(self.endpoint, args=(self.project.organization.slug, self.project.slug))
        response = self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {token.token}", format="json")

        assert response.status_code == 403


@region_silo_test
class ProjectGroupingConfigsTest(APITestCase):

    endpoint = "sentry-api-0-project-grouping-configs"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    @with_feature({"organizations:grouping-tree-ui": False})
    @mock.patch("sentry.grouping.strategies.base.projectoptions.LATEST_EPOCH", 7)
    def test_feature_flag_off(self):
        response = self.get_success_response(self.project.organization.slug, self.project.slug)
        for config in response.data:
            assert config["latest"] == (config["id"] == "newstyle:2023-01-11")

    @with_feature({"organizations:grouping-tree-ui": True})
    @mock.patch("sentry.grouping.strategies.base.projectoptions.LATEST_EPOCH", 7)
    def test_feature_flag_on(self):
        response = self.get_success_response(self.project.organization.slug, self.project.slug)
        for config in response.data:
            assert config["latest"] == (config["id"] == "newstyle:2023-01-11")
