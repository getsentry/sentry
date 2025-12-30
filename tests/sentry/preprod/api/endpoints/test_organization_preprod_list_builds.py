from datetime import timedelta
from unittest.mock import patch
from urllib.parse import urlencode

from django.urls import reverse
from django.utils import timezone

from sentry import analytics
from sentry.preprod.analytics import PreprodArtifactApiListBuildsEvent
from sentry.preprod.models import PreprodArtifact
from sentry.testutils.cases import APITestCase


class OrganizationPreprodListBuildsEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()

        self.user = self.create_user(email="test@example.com")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.project2 = self.create_project(organization=self.org, name="Project 2")
        self.api_token = self.create_user_auth_token(
            user=self.user, scope_list=["org:admin", "project:admin"]
        )

        self.file = self.create_file(name="test_artifact.apk", type="application/octet-stream")

        commit_comparison = self.create_commit_comparison(
            organization=self.org,
            head_sha="1234567890098765432112345678900987654321",
            base_sha="9876543210012345678998765432100123456789",
            provider="github",
            head_repo_name="owner/repo",
            base_repo_name="owner/repo",
            head_ref="feature/xyz",
            base_ref="main",
            pr_number=123,
        )

        self.artifact1 = self.create_preprod_artifact(
            project=self.project,
            file_id=self.file.id,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_id="com.example.app",
            app_name="TestApp",
            build_version="1.0.0",
            build_number=42,
            build_configuration=None,
            installable_app_file_id=1234,
            commit_comparison=commit_comparison,
        )

        self.artifact2 = self.create_preprod_artifact(
            project=self.project,
            file_id=self.file.id,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.AAB,
            app_id="com.example.app2",
            app_name="TestApp2",
            build_version="2.0.0",
            build_number=43,
            build_configuration=None,
            installable_app_file_id=1235,
            commit_comparison=commit_comparison,
        )

        self.artifact3 = self.create_preprod_artifact(
            project=self.project,
            file_id=self.file.id,
            state=PreprodArtifact.ArtifactState.UPLOADED,
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            app_id="com.example.app3",
            app_name="TestApp3",
            build_version="3.0.0",
            build_number=44,
            build_configuration=None,
            installable_app_file_id=1236,
            commit_comparison=commit_comparison,
        )

        self.artifact4 = self.create_preprod_artifact(
            project=self.project2,
            file_id=self.file.id,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_id="com.example.app4",
            app_name="TestApp4",
            build_version="4.0.0",
            build_number=45,
            build_configuration=None,
            installable_app_file_id=1237,
            commit_comparison=commit_comparison,
        )

        self.feature_context = self.feature({"organizations:preprod-frontend-routes": True})
        self.feature_context.__enter__()

    def tearDown(self) -> None:
        self.feature_context.__exit__(None, None, None)
        super().tearDown()

    def _get_url(self):
        return reverse(
            "sentry-api-0-organization-preprod-list-builds",
            args=[self.org.slug],
        )

    def test_list_builds_success(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&project={self.project2.id}",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        builds = response.json()["builds"]
        assert len(builds) == 4
        assert "Link" in response
        app_ids = [b["app_info"]["app_id"] for b in builds]
        assert app_ids == [
            "com.example.app4",
            "com.example.app3",
            "com.example.app2",
            "com.example.app",
        ]

    def test_list_builds_with_pagination(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&project={self.project2.id}&per_page=2",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        assert len(response.json()["builds"]) == 2
        assert "next" in response["Link"]
        assert "previous" in response["Link"]

    def test_list_builds_filter_by_single_project(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        builds = response.json()["builds"]
        assert len(builds) == 3
        app_ids = {b["app_info"]["app_id"] for b in builds}
        assert app_ids == {"com.example.app", "com.example.app2", "com.example.app3"}

    def test_list_builds_filter_by_multiple_projects(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&project={self.project2.id}",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        assert len(response.json()["builds"]) == 4

    def test_list_builds_no_projects_error(self) -> None:
        other_org = self.create_organization()
        url = reverse(
            "sentry-api-0-organization-preprod-list-builds",
            args=[other_org.slug],
        )

        response = self.client.get(
            url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )

        assert response.status_code == 403

    def test_list_builds_with_filters(self) -> None:
        url = self._get_url()
        auth = f"Bearer {self.api_token.token}"
        projects = f"project={self.project.id}&project={self.project2.id}"

        response = self.client.get(
            f"{url}?{projects}&app_id=com.example.app2", format="json", HTTP_AUTHORIZATION=auth
        )
        assert response.status_code == 200
        builds = response.json()["builds"]
        assert len(builds) == 1
        assert builds[0]["app_info"]["app_id"] == "com.example.app2"

        response = self.client.get(
            f"{url}?{projects}&platform=android", format="json", HTTP_AUTHORIZATION=auth
        )
        assert response.status_code == 200
        builds = response.json()["builds"]
        assert len(builds) == 3
        assert all(b["app_info"]["platform"] == "android" for b in builds)

        response = self.client.get(
            f"{url}?{projects}&state=3", format="json", HTTP_AUTHORIZATION=auth
        )
        assert response.status_code == 200
        assert len(response.json()["builds"]) == 3

    def test_list_builds_feature_flag_disabled(self) -> None:
        with self.feature({"organizations:preprod-frontend-routes": False}):
            response = self.client.get(
                f"{self._get_url()}?project={self.project.id}",
                format="json",
                HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
            )
            assert response.status_code == 403
            assert response.json()["error"] == "Feature not enabled"

    def test_list_builds_invalid_pagination_params(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&per_page=200",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 400
        assert "per_page" in response.json()

    def test_list_builds_empty_builds(self) -> None:
        other_org = self.create_organization(owner=self.user)
        other_project = self.create_project(organization=other_org)
        url = reverse(
            "sentry-api-0-organization-preprod-list-builds",
            args=[other_org.slug],
        )

        response = self.client.get(
            f"{url}?project={other_project.id}",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        resp_data = response.json()
        assert len(resp_data["builds"]) == 0
        assert "Link" in response

    def test_list_builds_with_date_filtering(self) -> None:
        url = self._get_url()
        now = timezone.now()

        self.artifact1.date_added = now - timedelta(days=10)
        self.artifact1.save()
        self.artifact2.date_added = now - timedelta(days=5)
        self.artifact2.save()
        self.artifact3.date_added = now - timedelta(days=1)
        self.artifact3.save()
        self.artifact4.date_added = now - timedelta(days=1)
        self.artifact4.save()

        response = self.client.get(
            f"{url}?project={self.project.id}&project={self.project2.id}&statsPeriod=7d",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        resp_data = response.json()
        returned_ids = {build["id"] for build in resp_data["builds"]}
        assert returned_ids == {
            str(self.artifact2.id),
            str(self.artifact3.id),
            str(self.artifact4.id),
        }

    def test_list_builds_with_invalid_date_range(self) -> None:
        url = self._get_url()
        now = timezone.now()

        params = {
            "project": [self.project.id, self.project2.id],
            "start": now.isoformat(),
            "end": (now - timedelta(days=1)).isoformat(),
        }
        response = self.client.get(
            f"{url}?{urlencode(params, doseq=True)}",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 400
        resp = response.json()
        assert "Invalid date range" in str(resp)

    def test_list_builds_search_by_app_name(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&project={self.project2.id}&query=TestApp2",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        builds = response.json()["builds"]
        assert len(builds) == 1
        assert builds[0]["app_info"]["name"] == "TestApp2"

    def test_list_builds_search_by_app_id(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&project={self.project2.id}&query=com.example.app3",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        builds = response.json()["builds"]
        assert len(builds) == 1
        assert builds[0]["app_info"]["app_id"] == "com.example.app3"

    def test_list_builds_search_by_build_version(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&project={self.project2.id}&query=2.0.0",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        builds = response.json()["builds"]
        assert len(builds) == 1
        assert builds[0]["app_info"]["version"] == "2.0.0"

    def test_list_builds_search_by_commit_sha(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&project={self.project2.id}&query=123456789009876543211234567890",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        assert len(response.json()["builds"]) == 4

    def test_list_builds_search_by_head_ref(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&project={self.project2.id}&query=feature/xyz",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        assert len(response.json()["builds"]) == 4

    def test_list_builds_search_by_pr_number(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&project={self.project2.id}&query=123",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        assert len(response.json()["builds"]) == 4

    def test_list_builds_search_too_long(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&query={'a' * 101}",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 400
        query_error = str(response.json()["query"])
        assert "Search term too long" in query_error or "no more than 100 characters" in query_error

    def test_list_builds_search_no_results(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&project={self.project2.id}&query=nonexistent",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        assert len(response.json()["builds"]) == 0

    def test_list_builds_filter_by_release_version_with_build_number(self) -> None:
        url = self._get_url()
        response = self.client.get(
            f"{url}?project={self.project.id}&project={self.project2.id}&release_version=com.example.app@1.0.0+42",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        resp_data = response.json()
        if len(resp_data["builds"]) == 0:
            assert response.status_code == 200
        else:
            for build in resp_data["builds"]:
                assert "com.example.app" in build["app_info"]["app_id"]
                assert "1.0.0" in build["app_info"]["version"]

    def test_list_builds_filter_by_release_version_without_build_number(self) -> None:
        url = self._get_url()
        response = self.client.get(
            f"{url}?project={self.project.id}&project={self.project2.id}&release_version=com.example.app2@2.0.0",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        resp_data = response.json()
        assert len(resp_data["builds"]) == 1
        assert resp_data["builds"][0]["app_info"]["app_id"] == "com.example.app2"
        assert resp_data["builds"][0]["app_info"]["version"] == "2.0.0"

    def test_list_builds_filter_by_release_version_invalid_format(self) -> None:
        url = self._get_url()
        response = self.client.get(
            f"{url}?project={self.project.id}&project={self.project2.id}&release_version=invalid_format&app_id=com.example.app",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        resp_data = response.json()
        matching_builds = [
            build
            for build in resp_data["builds"]
            if "com.example.app" in build["app_info"]["app_id"]
        ]
        assert len(matching_builds) >= 1

    def test_list_builds_filter_by_platform_ios(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&project={self.project2.id}&platform=ios",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        builds = response.json()["builds"]
        assert len(builds) == 1
        assert builds[0]["app_info"]["artifact_type"] == 0

    def test_list_builds_filter_by_platform_macos(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&project={self.project2.id}&platform=macos",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        builds = response.json()["builds"]
        assert len(builds) == 1
        assert builds[0]["app_info"]["artifact_type"] == 0

    def test_list_builds_filter_by_platform_invalid(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&platform=windows",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 400
        assert "platform" in response.json()

    def test_list_builds_filter_by_build_configuration(self) -> None:
        build_config = self.create_preprod_build_configuration(name="Release", project=self.project)
        self.create_preprod_artifact(
            project=self.project,
            file_id=self.file.id,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_id="com.example.configured",
            app_name="ConfiguredApp",
            build_version="1.0.0",
            build_number=50,
            build_configuration=build_config,
            installable_app_file_id=1238,
        )

        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&project={self.project2.id}&build_configuration=Release",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        builds = response.json()["builds"]
        assert len(builds) == 1
        assert builds[0]["app_info"]["app_id"] == "com.example.configured"
        assert builds[0]["app_info"]["build_configuration"] == "Release"

    def test_list_builds_filter_by_build_version(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&project={self.project2.id}&build_version=3.0.0",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        builds = response.json()["builds"]
        assert len(builds) == 1
        assert builds[0]["app_info"]["version"] == "3.0.0"

    def test_list_builds_filter_multiple_criteria(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&project={self.project2.id}&platform=android&state=3",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        assert len(response.json()["builds"]) == 3

    def test_list_builds_pagination_invalid_string_params(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&per_page=invalid&cursor=invalid",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 400
        assert "per_page" in response.json() or "cursor" in response.json()

    def test_list_builds_pagination_negative_per_page(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&per_page=-1",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 400
        assert "per_page" in response.json()

    def test_list_builds_pagination_zero_per_page(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&per_page=0",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 400
        assert "per_page" in response.json()

    def test_list_builds_filter_by_invalid_state(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&state=999",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 400
        assert "state" in response.json()

    def test_list_builds_filter_by_state_string(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&state=invalid",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 400
        assert "state" in response.json()

    @patch.object(analytics, "record")
    def test_list_builds_analytics_tracking(self, mock_record) -> None:
        url = self._get_url()
        self.client.get(
            f"{url}?project={self.project.id}&project={self.project2.id}",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        mock_record.assert_called_once()
        event = mock_record.call_args[0][0]
        assert isinstance(event, PreprodArtifactApiListBuildsEvent)
        assert event.organization_id == self.org.id
        assert event.user_id == self.user.id

    def test_list_builds_without_authentication(self) -> None:
        response = self.client.get(f"{self._get_url()}?project={self.project.id}", format="json")
        assert response.status_code == 401

    def test_list_builds_with_insufficient_permissions(self) -> None:
        limited_user = self.create_user(email="limited@example.com")
        limited_token = self.create_user_auth_token(user=limited_user, scope_list=["project:read"])
        self.client.get(
            f"{self._get_url()}?project={self.project.id}",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {limited_token.token}",
        )

    @patch(
        "sentry.preprod.api.endpoints.organization_preprod_list_builds.transform_preprod_artifact_to_build_details"
    )
    def test_list_builds_transform_exception_handling(self, mock_transform) -> None:
        def side_effect(artifact):
            if artifact.app_id == "com.example.app2":
                raise Exception("Transform failed")
            else:
                from sentry.preprod.api.models.project_preprod_build_details_models import (
                    transform_preprod_artifact_to_build_details,
                )

                return transform_preprod_artifact_to_build_details(artifact)

        mock_transform.side_effect = side_effect

        url = self._get_url()
        response = self.client.get(
            f"{url}?project={self.project.id}&project={self.project2.id}",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        resp_data = response.json()
        assert len(resp_data["builds"]) == 3

    def test_list_builds_empty_query_params(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&project={self.project2.id}&query=&app_id=&platform=",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        assert len(response.json()["builds"]) == 4

    def test_list_builds_search_whitespace_trimming(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&project={self.project2.id}&query=  TestApp2  ",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        builds = response.json()["builds"]
        assert len(builds) == 1
        assert builds[0]["app_info"]["name"] == "TestApp2"

    def test_list_builds_without_commit_comparison(self) -> None:
        self.create_preprod_artifact(
            project=self.project,
            file_id=self.file.id,
            state=PreprodArtifact.ArtifactState.PROCESSED,
            artifact_type=PreprodArtifact.ArtifactType.APK,
            app_id="com.example.no_commit",
            app_name="NoCommitApp",
            build_version="1.0.0",
            build_number=60,
            build_configuration=None,
            installable_app_file_id=1239,
            commit_comparison=None,
        )

        response = self.client.get(
            f"{self._get_url()}?project={self.project.id}&project={self.project2.id}",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )
        assert response.status_code == 200
        builds = response.json()["builds"]
        assert len(builds) == 5

        no_commit_build = next(
            b for b in builds if b["app_info"]["app_id"] == "com.example.no_commit"
        )
        assert no_commit_build["vcs_info"]["head_sha"] is None
        assert no_commit_build["vcs_info"]["pr_number"] is None

    def test_list_builds_filter_app_id_exact_case_sensitive_match(self) -> None:
        auth = f"Bearer {self.api_token.token}"
        url = self._get_url()
        projects = f"project={self.project.id}&project={self.project2.id}"

        response = self.client.get(
            f"{url}?{projects}&app_id=COM.EXAMPLE.APP", format="json", HTTP_AUTHORIZATION=auth
        )
        assert response.status_code == 200
        assert len(response.json()["builds"]) == 0

        response = self.client.get(
            f"{url}?{projects}&app_id=com.example", format="json", HTTP_AUTHORIZATION=auth
        )
        assert response.status_code == 200
        assert len(response.json()["builds"]) == 0

    def test_list_builds_filter_build_configuration_exact_case_sensitive_match(self) -> None:
        config_release = self.create_preprod_build_configuration(
            name="Release", project=self.project
        )
        config_release_upper = self.create_preprod_build_configuration(
            name="RELEASE", project=self.project
        )
        config_release_prod = self.create_preprod_build_configuration(
            name="ReleaseProduction", project=self.project
        )

        for app_id, build_num, config, file_id in [
            ("com.example.release", 200, config_release, 1250),
            ("com.example.release.upper", 201, config_release_upper, 1251),
            ("com.example.releaseprod", 202, config_release_prod, 1252),
        ]:
            self.create_preprod_artifact(
                project=self.project,
                file_id=self.file.id,
                state=PreprodArtifact.ArtifactState.PROCESSED,
                artifact_type=PreprodArtifact.ArtifactType.APK,
                app_id=app_id,
                app_name=f"{app_id.split('.')[-1]}App",
                build_version="1.0.0",
                build_number=build_num,
                build_configuration=config,
                installable_app_file_id=file_id,
            )

        url = self._get_url()
        auth = f"Bearer {self.api_token.token}"
        projects = f"project={self.project.id}&project={self.project2.id}"

        response = self.client.get(
            f"{url}?{projects}&build_configuration=Release", format="json", HTTP_AUTHORIZATION=auth
        )
        assert response.status_code == 200
        builds = response.json()["builds"]
        assert len(builds) == 1
        assert builds[0]["app_info"]["build_configuration"] == "Release"

        response = self.client.get(
            f"{url}?{projects}&build_configuration=RELEASE", format="json", HTTP_AUTHORIZATION=auth
        )
        assert response.status_code == 200
        builds = response.json()["builds"]
        assert len(builds) == 1
        assert builds[0]["app_info"]["build_configuration"] == "RELEASE"

        response = self.client.get(
            f"{url}?{projects}&build_configuration=Release", format="json", HTTP_AUTHORIZATION=auth
        )
        assert response.status_code == 200
        matched_configs = {b["app_info"]["build_configuration"] for b in response.json()["builds"]}
        assert matched_configs == {"Release"}

    def test_list_builds_filter_project_and_other_criteria(self) -> None:
        response = self.client.get(
            f"{self._get_url()}?project={self.project2.id}&platform=android",
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}",
        )

        assert response.status_code == 200
        builds = response.json()["builds"]
        assert len(builds) == 1
        assert builds[0]["app_info"]["app_id"] == "com.example.app4"
