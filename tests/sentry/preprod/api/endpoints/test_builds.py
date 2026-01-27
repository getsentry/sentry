from unittest.mock import ANY

import pytest
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

    def _assert_is_successful(self, response):
        assert response.status_code == 200, f"status {response.status_code} body {response.json()}"

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
        self._assert_is_successful(response)
        assert response.json() == []

    @with_feature("organizations:preprod-frontend-routes")
    def test_one_build(self) -> None:
        self.create_preprod_artifact()
        response = self._request({})
        self._assert_is_successful(response)
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
        self._assert_is_successful(response)
        assert response.json() == []

    @with_feature("organizations:preprod-frontend-routes")
    def test_build_in_another_project_slug(self) -> None:
        another_project = self.create_project(name="Baz", slug="baz")
        self.create_preprod_artifact(project=another_project)
        response = self._request({"projectSlug": [self.project.slug]})
        self._assert_is_successful(response)
        assert response.json() == []

    @with_feature("organizations:preprod-frontend-routes")
    def test_build_in_this_project(self) -> None:
        self.create_preprod_artifact()
        response = self._request({"project": [self.project.id]})
        self._assert_is_successful(response)
        assert len(response.json()) == 1

    @with_feature("organizations:preprod-frontend-routes")
    def test_build_in_this_project_slug(self) -> None:
        self.create_preprod_artifact()
        response = self._request({"projectSlug": [self.project.slug]})
        self._assert_is_successful(response)
        assert len(response.json()) == 1

    @with_feature("organizations:preprod-frontend-routes")
    def test_multiple_projects(self) -> None:
        project_a = self.create_project(name="AAA", slug="aaa")
        self.create_preprod_artifact(project=project_a)
        project_b = self.create_project(name="BBB", slug="bbb")
        self.create_preprod_artifact(project=project_b)
        response = self._request({"project": [project_a.id, project_b.id]})
        self._assert_is_successful(response)
        assert len(response.json()) == 2

    @with_feature("organizations:preprod-frontend-routes")
    def test_multiple_project_slugs(self) -> None:
        project_a = self.create_project(name="AAA", slug="aaa")
        self.create_preprod_artifact(project=project_a)
        project_b = self.create_project(name="BBB", slug="bbb")
        self.create_preprod_artifact(project=project_b)
        response = self._request({"projectSlug": [project_a.slug, project_b.slug]})
        self._assert_is_successful(response)
        assert len(response.json()) == 2

    @with_feature("organizations:preprod-frontend-routes")
    def test_per_page_respected(self) -> None:
        self.create_preprod_artifact()
        self.create_preprod_artifact()
        response = self._request({"per_page": 1})
        self._assert_is_successful(response)
        assert len(response.json()) == 1

    @with_feature("organizations:preprod-frontend-routes")
    def test_start_end_respected(self) -> None:
        self.create_preprod_artifact(date_added=before_now(days=5))
        middle = self.create_preprod_artifact(date_added=before_now(days=3))
        self.create_preprod_artifact(date_added=before_now(days=1))

        response = self._request({"start": before_now(days=4), "end": before_now(days=2)})
        self._assert_is_successful(response)
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
        self._assert_is_successful(response)
        assert len(response.json()) == 1
        assert response.json()[0]["app_info"]["app_id"] == "foo"

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_app_id_not_equals(self) -> None:
        self.create_preprod_artifact(app_id="foo")
        self.create_preprod_artifact(app_id="bar")
        response = self._request({"query": "!app_id:foo"})
        self._assert_is_successful(response)
        assert len(response.json()) == 1
        assert response.json()[0]["app_info"]["app_id"] == "bar"

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_app_id_in(self) -> None:
        self.create_preprod_artifact(app_id="foo")
        self.create_preprod_artifact(app_id="bar")
        response = self._request({"query": "app_id:[baz,foo]"})
        self._assert_is_successful(response)
        assert len(response.json()) == 1
        assert response.json()[0]["app_info"]["app_id"] == "foo"

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_app_id_in_is_list(self) -> None:
        self.create_preprod_artifact(app_id="foo")
        self.create_preprod_artifact(app_id="bar")
        response = self._request({"query": "app_id:[aaafooaaa]"})
        self._assert_is_successful(response)
        assert len(response.json()) == 0

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_app_id_not_in(self) -> None:
        self.create_preprod_artifact(app_id="foo")
        self.create_preprod_artifact(app_id="bar")
        self.create_preprod_artifact(app_id="baz")
        response = self._request({"query": "!app_id:[foo,bar]"})
        self._assert_is_successful(response)
        assert len(response.json()) == 1
        assert response.json()[0]["app_info"]["app_id"] == "baz"

    @with_feature("organizations:preprod-frontend-routes")
    def test_download_count_for_installable_artifact(self) -> None:
        # Create an installable artifact (has both installable_app_file_id and build_number)
        artifact = self.create_preprod_artifact(
            installable_app_file_id=12345,
        )
        # build_number must be in mobile_app_info for is_installable check
        self.create_preprod_artifact_mobile_app_info(
            preprod_artifact=artifact,
            build_number=100,
        )
        # Create InstallablePreprodArtifact records with download counts
        self.create_installable_preprod_artifact(artifact, download_count=5)
        self.create_installable_preprod_artifact(artifact, download_count=10)

        response = self._request({})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        # Download count should be the sum of all InstallablePreprodArtifact records
        assert data[0]["distribution_info"]["download_count"] == 15
        assert data[0]["distribution_info"]["is_installable"] is True

    @with_feature("organizations:preprod-frontend-routes")
    def test_is_installable(self) -> None:
        self.create_preprod_artifact(app_id="not_installable")
        artifact = self.create_preprod_artifact(
            app_id="installable",
            installable_app_file_id=12345,
            build_number=100,
        )
        self.create_installable_preprod_artifact(artifact, download_count=1)

        response = self._request({"query": "is:installable"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        assert data[0]["app_info"]["app_id"] == "installable"

    @with_feature("organizations:preprod-frontend-routes")
    def test_is_not_installable(self) -> None:
        self.create_preprod_artifact(app_id="not_installable")
        artifact = self.create_preprod_artifact(
            app_id="installable",
            installable_app_file_id=12345,
            build_number=100,
        )
        self.create_installable_preprod_artifact(artifact, download_count=1)

        response = self._request({"query": "!is:installable"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        assert data[0]["app_info"]["app_id"] == "not_installable"

    @with_feature("organizations:preprod-frontend-routes")
    def test_download_count_zero_for_non_installable_artifact(self) -> None:
        # Create a non-installable artifact (no installable_app_file_id)
        self.create_preprod_artifact()

        response = self._request({})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        assert data[0]["distribution_info"]["download_count"] == 0
        assert data[0]["distribution_info"]["is_installable"] is False

    @with_feature("organizations:preprod-frontend-routes")
    def test_download_count_multiple_artifacts(self) -> None:
        # Create multiple installable artifacts with different download counts
        artifact1 = self.create_preprod_artifact(
            app_id="com.app.one",
            installable_app_file_id=11111,
        )
        # build_number must be in mobile_app_info for is_installable check
        self.create_preprod_artifact_mobile_app_info(
            preprod_artifact=artifact1,
            build_number=1,
        )
        self.create_installable_preprod_artifact(artifact1, download_count=100)

        artifact2 = self.create_preprod_artifact(
            app_id="com.app.two",
            installable_app_file_id=22222,
        )
        # build_number must be in mobile_app_info for is_installable check
        self.create_preprod_artifact_mobile_app_info(
            preprod_artifact=artifact2,
            build_number=2,
        )
        self.create_installable_preprod_artifact(artifact2, download_count=50)
        self.create_installable_preprod_artifact(artifact2, download_count=25)

        response = self._request({})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 2

        # Results are ordered by date_added descending, so artifact2 comes first
        app_two = next(b for b in data if b["app_info"]["app_id"] == "com.app.two")
        app_one = next(b for b in data if b["app_info"]["app_id"] == "com.app.one")

        assert app_one["distribution_info"]["download_count"] == 100
        assert app_two["distribution_info"]["download_count"] == 75

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_install_size(self) -> None:
        # Create artifacts with different install sizes via size metrics
        small_artifact = self.create_preprod_artifact(app_id="small.app")
        self.create_preprod_artifact_size_metrics(small_artifact, max_install_size=1000000)  # 1 MB

        large_artifact = self.create_preprod_artifact(app_id="large.app")
        self.create_preprod_artifact_size_metrics(large_artifact, max_install_size=5000000)  # 5 MB

        # Filter for artifacts with install_size > 2 MB
        response = self._request({"query": "install_size:>2000000"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        assert data[0]["app_info"]["app_id"] == "large.app"

        # Filter for artifacts with install_size < 2 MB
        response = self._request({"query": "install_size:<2000000"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        assert data[0]["app_info"]["app_id"] == "small.app"

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_build_configuration_name(self) -> None:
        debug_config = self.create_preprod_build_configuration(name="Debug")
        release_config = self.create_preprod_build_configuration(name="Release")

        self.create_preprod_artifact(app_id="debug.app", build_configuration=debug_config)
        self.create_preprod_artifact(app_id="release.app", build_configuration=release_config)

        response = self._request({"query": "build_configuration_name:Debug"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        assert data[0]["app_info"]["app_id"] == "debug.app"

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_git_head_ref(self) -> None:
        main_cc = self.create_commit_comparison(organization=self.organization, head_ref="main")
        feature_cc = self.create_commit_comparison(
            organization=self.organization, head_ref="feature/new-stuff"
        )

        self.create_preprod_artifact(app_id="main.app", commit_comparison=main_cc)
        self.create_preprod_artifact(app_id="feature.app", commit_comparison=feature_cc)

        response = self._request({"query": "git_head_ref:main"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        assert data[0]["app_info"]["app_id"] == "main.app"

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_has_git_head_ref(self) -> None:
        cc_with_branch = self.create_commit_comparison(
            organization=self.organization, head_ref="main"
        )
        cc_without_branch = self.create_commit_comparison(
            organization=self.organization, head_ref=None
        )

        self.create_preprod_artifact(app_id="with_branch.app", commit_comparison=cc_with_branch)
        self.create_preprod_artifact(
            app_id="without_branch.app", commit_comparison=cc_without_branch
        )
        self.create_preprod_artifact(app_id="no_cc.app")

        response = self._request({"query": "has:git_head_ref"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        assert data[0]["app_info"]["app_id"] == "with_branch.app"

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_not_has_git_head_ref(self) -> None:
        cc_with_branch = self.create_commit_comparison(
            organization=self.organization, head_ref="main"
        )
        cc_without_branch = self.create_commit_comparison(
            organization=self.organization, head_ref=None
        )

        self.create_preprod_artifact(app_id="with_branch.app", commit_comparison=cc_with_branch)
        self.create_preprod_artifact(
            app_id="without_branch.app", commit_comparison=cc_without_branch
        )
        self.create_preprod_artifact(app_id="no_cc.app")

        response = self._request({"query": "!has:git_head_ref"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 2
        app_ids = {d["app_info"]["app_id"] for d in data}
        assert app_ids == {"without_branch.app", "no_cc.app"}

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_git_head_sha(self) -> None:
        cc1 = self.create_commit_comparison(
            organization=self.organization, head_sha="abc123" + "0" * 34
        )
        cc2 = self.create_commit_comparison(
            organization=self.organization, head_sha="def456" + "0" * 34
        )

        self.create_preprod_artifact(app_id="sha1.app", commit_comparison=cc1)
        self.create_preprod_artifact(app_id="sha2.app", commit_comparison=cc2)

        response = self._request({"query": "git_head_sha:abc123" + "0" * 34})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        assert data[0]["app_info"]["app_id"] == "sha1.app"

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_git_base_sha(self) -> None:
        cc1 = self.create_commit_comparison(
            organization=self.organization, base_sha="base111" + "1" * 33
        )
        cc2 = self.create_commit_comparison(
            organization=self.organization, base_sha="base222" + "2" * 33
        )

        self.create_preprod_artifact(app_id="base1.app", commit_comparison=cc1)
        self.create_preprod_artifact(app_id="base2.app", commit_comparison=cc2)

        response = self._request({"query": "git_base_sha:base111" + "1" * 33})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        assert data[0]["app_info"]["app_id"] == "base1.app"

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_git_pr_number(self) -> None:
        cc1 = self.create_commit_comparison(organization=self.organization, pr_number=123)
        cc2 = self.create_commit_comparison(organization=self.organization, pr_number=456)

        self.create_preprod_artifact(app_id="pr123.app", commit_comparison=cc1)
        self.create_preprod_artifact(app_id="pr456.app", commit_comparison=cc2)

        response = self._request({"query": "git_pr_number:123"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        assert data[0]["app_info"]["app_id"] == "pr123.app"

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_platform_name_apple(self) -> None:
        from sentry.preprod.models import PreprodArtifact

        self.create_preprod_artifact(
            app_id="ios.app", artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE
        )
        self.create_preprod_artifact(
            app_id="android.app", artifact_type=PreprodArtifact.ArtifactType.APK
        )

        response = self._request({"query": "platform_name:apple"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        assert data[0]["app_info"]["app_id"] == "ios.app"

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_platform_name_android(self) -> None:
        from sentry.preprod.models import PreprodArtifact

        self.create_preprod_artifact(
            app_id="ios.app", artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE
        )
        self.create_preprod_artifact(
            app_id="android.apk", artifact_type=PreprodArtifact.ArtifactType.APK
        )
        self.create_preprod_artifact(
            app_id="android.aab", artifact_type=PreprodArtifact.ArtifactType.AAB
        )

        response = self._request({"query": "platform_name:android"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 2
        app_ids = {d["app_info"]["app_id"] for d in data}
        assert app_ids == {"android.apk", "android.aab"}

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_platform_name_in(self) -> None:
        from sentry.preprod.models import PreprodArtifact

        self.create_preprod_artifact(
            app_id="ios.app", artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE
        )
        self.create_preprod_artifact(
            app_id="android.apk", artifact_type=PreprodArtifact.ArtifactType.APK
        )
        self.create_preprod_artifact(
            app_id="android.aab", artifact_type=PreprodArtifact.ArtifactType.AAB
        )

        response = self._request({"query": "platform_name:[apple,android]"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 3
        app_ids = {d["app_info"]["app_id"] for d in data}
        assert app_ids == {"ios.app", "android.apk", "android.aab"}

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_platform_name_not_in(self) -> None:
        from sentry.preprod.models import PreprodArtifact

        self.create_preprod_artifact(
            app_id="ios.app", artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE
        )
        self.create_preprod_artifact(
            app_id="android.apk", artifact_type=PreprodArtifact.ArtifactType.APK
        )
        self.create_preprod_artifact(
            app_id="android.aab", artifact_type=PreprodArtifact.ArtifactType.AAB
        )

        response = self._request({"query": "!platform_name:[apple]"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 2
        app_ids = {d["app_info"]["app_id"] for d in data}
        assert app_ids == {"android.apk", "android.aab"}

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_operator_greater_than(self) -> None:
        self.create_preprod_artifact(app_id="build100.app", build_number=100)
        self.create_preprod_artifact(app_id="build200.app", build_number=200)
        self.create_preprod_artifact(app_id="build300.app", build_number=300)

        response = self._request({"query": "build_number:>200"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        assert data[0]["app_info"]["app_id"] == "build300.app"

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_operator_less_than(self) -> None:
        self.create_preprod_artifact(app_id="build100.app", build_number=100)
        self.create_preprod_artifact(app_id="build200.app", build_number=200)
        self.create_preprod_artifact(app_id="build300.app", build_number=300)

        response = self._request({"query": "build_number:<200"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        assert data[0]["app_info"]["app_id"] == "build100.app"

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_operator_greater_than_or_equal(self) -> None:
        self.create_preprod_artifact(app_id="build100.app", build_number=100)
        self.create_preprod_artifact(app_id="build200.app", build_number=200)
        self.create_preprod_artifact(app_id="build300.app", build_number=300)

        response = self._request({"query": "build_number:>=200"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 2
        app_ids = {d["app_info"]["app_id"] for d in data}
        assert app_ids == {"build200.app", "build300.app"}

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_operator_less_than_or_equal(self) -> None:
        self.create_preprod_artifact(app_id="build100.app", build_number=100)
        self.create_preprod_artifact(app_id="build200.app", build_number=200)
        self.create_preprod_artifact(app_id="build300.app", build_number=300)

        response = self._request({"query": "build_number:<=200"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 2
        app_ids = {d["app_info"]["app_id"] for d in data}
        assert app_ids == {"build100.app", "build200.app"}

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_operator_contains(self) -> None:
        cc1 = self.create_commit_comparison(
            organization=self.organization, head_ref="feature/add-login"
        )
        cc2 = self.create_commit_comparison(
            organization=self.organization, head_ref="feature/add-signup"
        )
        cc3 = self.create_commit_comparison(
            organization=self.organization, head_ref="bugfix/fix-crash"
        )

        self.create_preprod_artifact(app_id="login.app", commit_comparison=cc1)
        self.create_preprod_artifact(app_id="signup.app", commit_comparison=cc2)
        self.create_preprod_artifact(app_id="crash.app", commit_comparison=cc3)

        response = self._request({"query": "git_head_ref:Containsfeature"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 2
        app_ids = {d["app_info"]["app_id"] for d in data}
        assert app_ids == {"login.app", "signup.app"}

    @with_feature("organizations:preprod-frontend-routes")
    def test_query_operator_not_contains(self) -> None:
        cc1 = self.create_commit_comparison(
            organization=self.organization, head_ref="feature/add-login"
        )
        cc2 = self.create_commit_comparison(
            organization=self.organization, head_ref="feature/add-signup"
        )
        cc3 = self.create_commit_comparison(
            organization=self.organization, head_ref="bugfix/fix-crash"
        )

        self.create_preprod_artifact(app_id="login.app", commit_comparison=cc1)
        self.create_preprod_artifact(app_id="signup.app", commit_comparison=cc2)
        self.create_preprod_artifact(app_id="crash.app", commit_comparison=cc3)

        response = self._request({"query": "!git_head_ref:Containsfeature"})
        self._assert_is_successful(response)
        data = response.json()
        assert data[0]["app_info"]["app_id"] == "crash.app"

    @with_feature("organizations:preprod-frontend-routes")
    def test_free_text_search_app_id(self) -> None:
        self.create_preprod_artifact(app_id="com.example.myapp")
        self.create_preprod_artifact(app_id="com.other.app")
        self.create_preprod_artifact(app_id="com.different.package")

        response = self._request({"query": "myapp"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        assert data[0]["app_info"]["app_id"] == "com.example.myapp"

    @with_feature("organizations:preprod-frontend-routes")
    def test_free_text_search_app_name(self) -> None:
        self.create_preprod_artifact(app_id="com.example.one", app_name="MyAwesomeApp")
        self.create_preprod_artifact(app_id="com.example.two", app_name="OtherApp")

        response = self._request({"query": "Awesome"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        assert data[0]["app_info"]["app_id"] == "com.example.one"

    @with_feature("organizations:preprod-frontend-routes")
    def test_free_text_search_build_version(self) -> None:
        self.create_preprod_artifact(app_id="app1", build_version="1.2.3-beta")
        self.create_preprod_artifact(app_id="app2", build_version="2.0.0-release")

        response = self._request({"query": "beta"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        assert data[0]["app_info"]["app_id"] == "app1"

    @with_feature("organizations:preprod-frontend-routes")
    def test_free_text_search_commit_sha(self) -> None:
        cc1 = self.create_commit_comparison(
            organization=self.organization, head_sha="abc123def456" + "0" * 28
        )
        cc2 = self.create_commit_comparison(
            organization=self.organization, head_sha="xyz789uvw012" + "1" * 28
        )

        self.create_preprod_artifact(app_id="app1", commit_comparison=cc1)
        self.create_preprod_artifact(app_id="app2", commit_comparison=cc2)

        response = self._request({"query": "abc123"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        assert data[0]["app_info"]["app_id"] == "app1"

    @with_feature("organizations:preprod-frontend-routes")
    def test_free_text_search_branch(self) -> None:
        cc1 = self.create_commit_comparison(
            organization=self.organization, head_ref="feature/new-login"
        )
        cc2 = self.create_commit_comparison(
            organization=self.organization, head_ref="bugfix/crash-fix"
        )

        self.create_preprod_artifact(app_id="app1", commit_comparison=cc1)
        self.create_preprod_artifact(app_id="app2", commit_comparison=cc2)

        response = self._request({"query": "login"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        assert data[0]["app_info"]["app_id"] == "app1"

    @with_feature("organizations:preprod-frontend-routes")
    def test_free_text_search_pr_number(self) -> None:
        cc1 = self.create_commit_comparison(organization=self.organization, pr_number=12345)
        cc2 = self.create_commit_comparison(organization=self.organization, pr_number=67890)

        self.create_preprod_artifact(app_id="app1", commit_comparison=cc1)
        self.create_preprod_artifact(app_id="app2", commit_comparison=cc2)

        response = self._request({"query": "12345"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        assert data[0]["app_info"]["app_id"] == "app1"

    @with_feature("organizations:preprod-frontend-routes")
    def test_free_text_search_no_matches(self) -> None:
        self.create_preprod_artifact(app_id="com.example.app")
        self.create_preprod_artifact(app_id="com.other.app")

        response = self._request({"query": "nonexistent"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 0

    @with_feature("organizations:preprod-frontend-routes")
    def test_free_text_search_empty_query(self) -> None:
        self.create_preprod_artifact(app_id="app1")
        self.create_preprod_artifact(app_id="app2")

        response = self._request({"query": ""})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 2

    @with_feature("organizations:preprod-frontend-routes")
    def test_free_text_search_whitespace_only(self) -> None:
        self.create_preprod_artifact(app_id="app1")
        self.create_preprod_artifact(app_id="app2")

        response = self._request({"query": "   "})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 2

    @with_feature("organizations:preprod-frontend-routes")
    def test_free_text_search_case_insensitive(self) -> None:
        self.create_preprod_artifact(app_id="com.Example.MyApp")

        response = self._request({"query": "example"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        assert data[0]["app_info"]["app_id"] == "com.Example.MyApp"

    @with_feature("organizations:preprod-frontend-routes")
    def test_free_text_search_multiple_matches(self) -> None:
        self.create_preprod_artifact(app_id="com.test.one", app_name="TestApp")
        self.create_preprod_artifact(app_id="com.test.two", build_version="1.0-test")

        response = self._request({"query": "test"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 2
        app_ids = {d["app_info"]["app_id"] for d in data}
        assert app_ids == {"com.test.one", "com.test.two"}

    @with_feature("organizations:preprod-frontend-routes")
    def test_free_text_search_with_structured_filter(self) -> None:
        from sentry.preprod.models import PreprodArtifact

        cc = self.create_commit_comparison(
            organization=self.organization, head_ref="feature/awesome"
        )
        self.create_preprod_artifact(
            app_id="com.example.ios",
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=cc,
        )
        self.create_preprod_artifact(
            app_id="com.example.android",
            artifact_type=PreprodArtifact.ArtifactType.APK,
            commit_comparison=cc,
        )

        response = self._request({"query": "awesome platform_name:android"})
        self._assert_is_successful(response)
        data = response.json()
        assert len(data) == 1
        assert data[0]["app_info"]["app_id"] == "com.example.android"


class QuerysetForQueryTest(APITestCase):
    """Tests for the queryset_for_query, artifact_in_queryset, and artifact_matches_query functions."""

    def test_queryset_for_query_empty_query(self) -> None:
        from sentry.preprod.api.endpoints.builds import queryset_for_query

        artifact = self.create_preprod_artifact(app_id="com.example.app")
        queryset = queryset_for_query("", self.organization)
        assert artifact in queryset

    def test_queryset_for_query_with_filter(self) -> None:
        from sentry.preprod.api.endpoints.builds import queryset_for_query

        artifact1 = self.create_preprod_artifact(app_id="com.example.one")
        self.create_preprod_artifact(app_id="com.example.two")

        queryset = queryset_for_query("app_id:com.example.one", self.organization)
        results = list(queryset)
        assert len(results) == 1
        assert results[0].id == artifact1.id

    def test_queryset_for_query_platform_filter(self) -> None:
        from sentry.preprod.api.endpoints.builds import queryset_for_query
        from sentry.preprod.models import PreprodArtifact

        ios_artifact = self.create_preprod_artifact(
            app_id="ios.app", artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE
        )
        self.create_preprod_artifact(
            app_id="android.app", artifact_type=PreprodArtifact.ArtifactType.APK
        )

        queryset = queryset_for_query("platform_name:apple", self.organization)
        results = list(queryset)
        assert len(results) == 1
        assert results[0].id == ios_artifact.id

    def test_queryset_for_query_invalid_query(self) -> None:
        from sentry.exceptions import InvalidSearchQuery
        from sentry.preprod.api.endpoints.builds import queryset_for_query

        with pytest.raises(InvalidSearchQuery):
            queryset_for_query("invalid_key:value", self.organization)

    def test_artifact_in_queryset_returns_true(self) -> None:
        from sentry.preprod.api.endpoints.builds import artifact_in_queryset, queryset_for_query

        artifact = self.create_preprod_artifact(app_id="com.example.app")
        queryset = queryset_for_query("", self.organization)
        assert artifact_in_queryset(artifact, queryset) is True

    def test_artifact_in_queryset_returns_false(self) -> None:
        from sentry.preprod.api.endpoints.builds import artifact_in_queryset, queryset_for_query

        artifact = self.create_preprod_artifact(app_id="com.example.one")
        queryset = queryset_for_query("app_id:com.example.two", self.organization)
        assert artifact_in_queryset(artifact, queryset) is False

    def test_artifact_in_queryset_with_filtered_queryset(self) -> None:
        from sentry.preprod.api.endpoints.builds import artifact_in_queryset, queryset_for_query

        artifact1 = self.create_preprod_artifact(app_id="foo")
        artifact2 = self.create_preprod_artifact(app_id="bar")

        queryset = queryset_for_query("app_id:foo", self.organization)
        assert artifact_in_queryset(artifact1, queryset) is True
        assert artifact_in_queryset(artifact2, queryset) is False

    def test_artifact_matches_query_returns_true(self) -> None:
        from sentry.preprod.api.endpoints.builds import artifact_matches_query

        artifact = self.create_preprod_artifact(app_id="com.example.app")
        assert artifact_matches_query(artifact, "app_id:com.example.app", self.organization) is True

    def test_artifact_matches_query_returns_false(self) -> None:
        from sentry.preprod.api.endpoints.builds import artifact_matches_query

        artifact = self.create_preprod_artifact(app_id="com.example.one")
        assert (
            artifact_matches_query(artifact, "app_id:com.example.two", self.organization) is False
        )

    def test_artifact_matches_query_empty_query(self) -> None:
        from sentry.preprod.api.endpoints.builds import artifact_matches_query

        artifact = self.create_preprod_artifact(app_id="com.example.app")
        assert artifact_matches_query(artifact, "", self.organization) is True

    def test_artifact_matches_query_complex_filter(self) -> None:
        from sentry.preprod.api.endpoints.builds import artifact_matches_query
        from sentry.preprod.models import PreprodArtifact

        cc = self.create_commit_comparison(
            organization=self.organization, head_ref="feature/test", pr_number=123
        )
        artifact = self.create_preprod_artifact(
            app_id="com.example.app",
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            commit_comparison=cc,
        )

        # Test multiple filters combined
        assert (
            artifact_matches_query(
                artifact, "platform_name:apple git_head_ref:feature/test", self.organization
            )
            is True
        )
        assert (
            artifact_matches_query(
                artifact, "platform_name:android git_head_ref:feature/test", self.organization
            )
            is False
        )

    def test_artifact_matches_query_with_numeric_filter(self) -> None:
        from sentry.preprod.api.endpoints.builds import artifact_matches_query

        artifact = self.create_preprod_artifact(build_number=100)

        assert artifact_matches_query(artifact, "build_number:>50", self.organization) is True
        assert artifact_matches_query(artifact, "build_number:<50", self.organization) is False

    def test_artifact_matches_query_invalid_query(self) -> None:
        from sentry.exceptions import InvalidSearchQuery
        from sentry.preprod.api.endpoints.builds import artifact_matches_query

        artifact = self.create_preprod_artifact()
        with pytest.raises(InvalidSearchQuery):
            artifact_matches_query(artifact, "invalid_key:value", self.organization)

    def test_artifact_matches_query_free_text_search(self) -> None:
        from sentry.preprod.api.endpoints.builds import artifact_matches_query

        artifact = self.create_preprod_artifact(app_id="com.example.myapp")

        assert artifact_matches_query(artifact, "myapp", self.organization) is True
        assert artifact_matches_query(artifact, "nonexistent", self.organization) is False

    def test_artifact_matches_query_installable_filter(self) -> None:
        from sentry.preprod.api.endpoints.builds import artifact_matches_query

        non_installable = self.create_preprod_artifact(app_id="not_installable")
        installable = self.create_preprod_artifact(
            app_id="installable",
            installable_app_file_id=12345,
        )

        assert artifact_matches_query(installable, "is:installable", self.organization) is True
        assert artifact_matches_query(non_installable, "is:installable", self.organization) is False
        assert artifact_matches_query(non_installable, "!is:installable", self.organization) is True
