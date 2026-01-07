from unittest.mock import ANY

from django.urls import reverse
from django.utils.functional import cached_property

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature


class BuildsEndpointTest(APITestCase):

    @cached_property
    def user_auth_token(self):
        auth_token = self.create_user_auth_token(
            self.user, scope_list=["org:admin", "project:admin"]
        )
        return auth_token.token

    def _request(self, query, token=None):
        token = self.user_auth_token if token is None else token
        url = reverse(
            "sentry-api-0-organization-builds",
            args=[self.organization.slug],
            query=query,
        )
        return self.client.get(url, format="json", HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_needs_feature(self) -> None:
        response = self._request({})
        assert response.status_code == 403
        assert response.json() == {
            "detail": "Feature organizations:preprod-frontend-routes is not enabled for the organization."
        }

    def test_invalid_token(self) -> None:
        response = self._request({}, token="Invalid")
        assert response.status_code == 401
        assert response.json() == {"detail": "Invalid token"}

    def test_wrong_user(self) -> None:
        random_user = self.create_user("foo@localhost")
        auth_token = self.create_user_auth_token(
            random_user, scope_list=["org:admin", "project:admin"]
        )

        response = self._request({}, token=auth_token.token)
        assert response.status_code == 403
        assert response.json() == {"detail": "You do not have permission to perform this action."}

    def test_missing_scopes(self) -> None:
        auth_token = self.create_user_auth_token(self.user, scope_list=[])

        response = self._request({}, token=auth_token.token)
        assert response.status_code == 403
        assert response.json() == {"detail": "You do not have permission to perform this action."}

    @with_feature("organizations:preprod-frontend-routes")
    def test_no_builds(self) -> None:
        response = self._request({})
        assert response.status_code == 200
        assert response.json() == []

    @with_feature("organizations:preprod-frontend-routes")
    def test_one_build(self) -> None:
        self.create_preprod_artifact()
        response = self._request({})
        assert response.status_code == 200
        assert response.json() == [
            {
                "id": ANY,
                "state": 3,
                "app_info": {
                    "app_id": "com.example.app",
                    "name": None,
                    "version": None,
                    "build_number": None,
                    "date_added": ANY,
                    "date_built": None,
                    "artifact_type": 2,
                    "platform": "android",
                    "is_installable": False,
                    "build_configuration": None,
                    "app_icon_id": None,
                    "apple_app_info": None,
                    "android_app_info": {
                        "has_proguard_mapping": True,
                    },
                },
                "base_artifact_id": None,
                "base_build_info": None,
                "distribution_info": {
                    "download_count": 0,
                    "is_installable": False,
                    "release_notes": None,
                },
                "vcs_info": {
                    "head_sha": None,
                    "base_sha": None,
                    "provider": None,
                    "head_repo_name": None,
                    "base_repo_name": None,
                    "head_ref": None,
                    "base_ref": None,
                    "pr_number": None,
                },
                "project_id": ANY,
                "posted_status_checks": None,
                "project_slug": "bar",
                "size_info": None,
            }
        ]

    @with_feature("organizations:preprod-frontend-routes")
    def test_bad_project(self) -> None:
        self.create_preprod_artifact()
        response = self._request({"project": [1]})
        assert response.status_code == 403
        assert response.json() == {"detail": "You do not have permission to perform this action."}

    @with_feature("organizations:preprod-frontend-routes")
    def test_bad_project_slug(self) -> None:
        self.create_preprod_artifact()
        response = self._request({"projectSlug": ["invalid"]})
        assert response.status_code == 403
        assert response.json() == {"detail": "You do not have permission to perform this action."}

    @with_feature("organizations:preprod-frontend-routes")
    def test_build_in_another_project(self) -> None:
        another_project = self.create_project(name="Baz", slug="baz")
        self.create_preprod_artifact(project=another_project)
        response = self._request({"project": [self.project.id]})
        assert response.status_code == 200
        assert response.json() == []

    @with_feature("organizations:preprod-frontend-routes")
    def test_build_in_another_project_slug(self) -> None:
        another_project = self.create_project(name="Baz", slug="baz")
        self.create_preprod_artifact(project=another_project)
        response = self._request({"projectSlug": [self.project.slug]})
        assert response.status_code == 200
        assert response.json() == []

    @with_feature("organizations:preprod-frontend-routes")
    def test_build_in_this_project(self) -> None:
        self.create_preprod_artifact()
        response = self._request({"project": [self.project.id]})
        assert response.status_code == 200
        assert len(response.json()) == 1

    @with_feature("organizations:preprod-frontend-routes")
    def test_build_in_this_project_slug(self) -> None:
        self.create_preprod_artifact()
        response = self._request({"projectSlug": [self.project.slug]})
        assert response.status_code == 200
        assert len(response.json()) == 1

    @with_feature("organizations:preprod-frontend-routes")
    def test_multiple_projects(self) -> None:
        project_a = self.create_project(name="AAA", slug="aaa")
        self.create_preprod_artifact(project=project_a)
        project_b = self.create_project(name="BBB", slug="bbb")
        self.create_preprod_artifact(project=project_b)
        response = self._request({"project": [project_a.id, project_b.id]})
        assert response.status_code == 200
        assert len(response.json()) == 2

    @with_feature("organizations:preprod-frontend-routes")
    def test_multiple_project_slugs(self) -> None:
        project_a = self.create_project(name="AAA", slug="aaa")
        self.create_preprod_artifact(project=project_a)
        project_b = self.create_project(name="BBB", slug="bbb")
        self.create_preprod_artifact(project=project_b)
        response = self._request({"projectSlug": [project_a.slug, project_b.slug]})
        assert response.status_code == 200
        assert len(response.json()) == 2

    @with_feature("organizations:preprod-frontend-routes")
    def test_per_page_respected(self) -> None:
        self.create_preprod_artifact()
        self.create_preprod_artifact()
        response = self._request({"per_page": 1})
        assert response.status_code == 200
        assert len(response.json()) == 1

    @with_feature("organizations:preprod-frontend-routes")
    def test_start_end_respected(self) -> None:
        self.create_preprod_artifact(date_added=before_now(days=5))
        middle = self.create_preprod_artifact(date_added=before_now(days=3))
        self.create_preprod_artifact(date_added=before_now(days=1))

        response = self._request({"start": before_now(days=4), "end": before_now(days=2)})
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["id"] == str(middle.id)

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_invalid(self) -> None:
        self.create_preprod_artifact(app_id="foo")
        response = self._request({"query": "no_such_key:foo"})
        assert response.status_code == 400
        assert response.json() == {"detail": "Invalid key for this search: no_such_key"}

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_app_id_equals(self) -> None:
        self.create_preprod_artifact(app_id="foo")
        self.create_preprod_artifact(app_id="bar")
        response = self._request({"query": "app_id:foo"})
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["app_info"]["app_id"] == "foo"

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_app_id_not_equals(self) -> None:
        self.create_preprod_artifact(app_id="foo")
        self.create_preprod_artifact(app_id="bar")
        response = self._request({"query": "!app_id:foo"})
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["app_info"]["app_id"] == "bar"

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_app_id_in(self) -> None:
        self.create_preprod_artifact(app_id="foo")
        self.create_preprod_artifact(app_id="bar")
        response = self._request({"query": "app_id:[baz,foo]"})
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["app_info"]["app_id"] == "foo"

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_app_id_in_is_list(self) -> None:
        self.create_preprod_artifact(app_id="foo")
        self.create_preprod_artifact(app_id="bar")
        response = self._request({"query": "app_id:[aaafooaaa]"})
        assert response.status_code == 200
        assert len(response.json()) == 0

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_package_name_is_app_id_alias(self) -> None:
        self.create_preprod_artifact(app_id="foo")
        self.create_preprod_artifact(app_id="bar")
        response = self._request({"query": "package_name:foo"})
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["app_info"]["app_id"] == "foo"

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_bundle_id_is_app_id_alias(self) -> None:
        self.create_preprod_artifact(app_id="foo")
        self.create_preprod_artifact(app_id="bar")
        response = self._request({"query": "bundle_id:foo"})
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["app_info"]["app_id"] == "foo"
