import csv
import io
from unittest.mock import patch

from django.urls import reverse
from django.utils.functional import cached_property

from sentry.preprod.models import PreprodArtifact
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils import json

EXPECTED_HEADER = [
    "app_name",
    "artifact_id",
    "app_id",
    "version",
    "platform",
    "install_groups",
    "upload_date",
    "download_count",
]


class BuildsExportEndpointTest(APITestCase):
    @cached_property
    def user_auth_token(self):
        auth_token = self.create_user_auth_token(
            self.user, scope_list=["org:admin", "project:admin"]
        )
        return auth_token.token

    def _request(self, query, token=None):
        token = self.user_auth_token if token is None else token
        url = reverse(
            "sentry-api-0-organization-builds-export",
            args=[self.organization.slug],
            query=query,
        )
        return self.client.get(url, HTTP_AUTHORIZATION=f"Bearer {token}")

    def _csv_rows(self, response) -> list[list[str]]:
        assert response.status_code == 200, (
            f"status {response.status_code} body {response.getvalue()!r}"
        )
        assert response["Content-Type"] == "text/csv"
        content = b"".join(response.streaming_content).decode("utf-8")
        return list(csv.reader(io.StringIO(content)))

    # --- auth ---------------------------------------------------------------

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

    def test_missing_scopes(self) -> None:
        auth_token = self.create_user_auth_token(self.user, scope_list=[])
        response = self._request({}, token=auth_token.token)
        assert response.status_code == 403

    # --- shape --------------------------------------------------------------

    def test_no_builds_only_header(self) -> None:
        response = self._request({})
        rows = self._csv_rows(response)
        assert rows == [EXPECTED_HEADER]

    def test_attachment_filename(self) -> None:
        response = self._request({})
        assert (
            response["Content-Disposition"]
            == f'attachment; filename="{self.organization.slug}-build-distribution.csv"'
        )

    def test_single_build_row(self) -> None:
        artifact = self.create_preprod_artifact(
            app_id="com.example.app",
            app_name="My App",
            build_version="1.2.3",
            build_number=42,
            installable_app_file_id=12345,
            artifact_type=PreprodArtifact.ArtifactType.APK,
        )
        self.create_installable_preprod_artifact(artifact, download_count=5)
        self.create_installable_preprod_artifact(artifact, download_count=10)

        rows = self._csv_rows(self._request({}))
        assert rows[0] == EXPECTED_HEADER
        assert len(rows) == 2
        (
            app_name,
            artifact_id,
            app_id,
            version,
            platform,
            install_groups,
            upload_date,
            download_count,
        ) = rows[1]
        assert app_name == "My App"
        assert artifact_id == str(artifact.id)
        assert app_id == "com.example.app"
        assert version == "1.2.3"
        assert platform == "android"
        assert install_groups == "[]"  # none set -> empty JSON array
        assert upload_date  # ISO timestamp present
        assert download_count == "15"

    def test_platform_apple(self) -> None:
        self.create_preprod_artifact(
            app_id="com.example.ios",
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
        )
        rows = self._csv_rows(self._request({}))
        assert len(rows) == 2
        assert rows[1][4] == "apple"

    def test_missing_mobile_app_info_blank_cells(self) -> None:
        # No app_name/version/build_number -> no mobile_app_info; those cells are blank.
        self.create_preprod_artifact(app_id="com.example.bare")
        rows = self._csv_rows(self._request({}))
        assert len(rows) == 2
        assert rows[1][0] == ""  # app_name
        assert rows[1][2] == "com.example.bare"  # app_id
        assert rows[1][3] == ""  # version
        assert rows[1][5] == "[]"  # install_groups
        assert rows[1][7] == "0"  # download_count

    def test_formula_injection_escaped(self) -> None:
        self.create_preprod_artifact(app_id="com.example.evil", app_name="=HYPERLINK(1)")
        rows = self._csv_rows(self._request({}))
        assert rows[1][0] == "'=HYPERLINK(1)"

    def test_install_groups_json_encoded(self) -> None:
        self.create_preprod_artifact(
            app_id="com.example.groups",
            extras={"install_groups": ["qa", "beta"]},
        )
        rows = self._csv_rows(self._request({}))
        # Emitted as a compact JSON array string, order preserved.
        assert rows[1][5] == '["qa","beta"]'
        # ...and round-trips back to the original list.
        assert json.loads(rows[1][5]) == ["qa", "beta"]

    # --- download count semantics -------------------------------------------

    def test_download_count_is_raw_sum(self) -> None:
        # Even when the build is not installable, the export reports the raw sum of
        # download counts (unlike the list API which forces 0 for non-installable).
        # NOTE: this behavior is under review (see EME-1035 follow-up).
        artifact = self.create_preprod_artifact(app_id="com.example.noinstall")
        self.create_installable_preprod_artifact(artifact, download_count=7)
        rows = self._csv_rows(self._request({}))
        assert rows[1][7] == "7"

    # --- filtering parity with the list endpoint ----------------------------

    def test_filter_by_query_app_id(self) -> None:
        self.create_preprod_artifact(app_id="foo")
        self.create_preprod_artifact(app_id="bar")
        rows = self._csv_rows(self._request({"query": "app_id:foo"}))
        assert len(rows) == 2
        assert rows[1][2] == "foo"

    def test_invalid_query_returns_400(self) -> None:
        self.create_preprod_artifact(app_id="foo")
        response = self._request({"query": "no_such_key:foo"})
        assert response.status_code == 400
        assert response.json() == {"detail": "Invalid key for this search: no_such_key"}

    def test_bad_project(self) -> None:
        self.create_preprod_artifact()
        response = self._request({"project": [1]})
        assert response.status_code == 403

    def test_build_in_another_project_excluded(self) -> None:
        another_project = self.create_project(name="Baz", slug="baz")
        self.create_preprod_artifact(project=another_project)
        rows = self._csv_rows(self._request({"project": [self.project.id]}))
        assert rows == [EXPECTED_HEADER]

    def test_display_distribution_excludes_snapshot_builds(self) -> None:
        self.create_preprod_artifact(app_id="com.regular.app")
        snapshot_artifact = self.create_preprod_artifact(app_id="com.snapshot.app")
        self.create_preprod_snapshot_metrics(preprod_artifact=snapshot_artifact, image_count=5)

        rows = self._csv_rows(self._request({"display": "distribution"}))
        assert len(rows) == 2
        assert rows[1][2] == "com.regular.app"

    def test_start_end_respected(self) -> None:
        self.create_preprod_artifact(app_id="old.app", date_added=before_now(days=5))
        middle = self.create_preprod_artifact(app_id="mid.app", date_added=before_now(days=3))
        self.create_preprod_artifact(app_id="new.app", date_added=before_now(days=1))

        rows = self._csv_rows(
            self._request({"start": before_now(days=4), "end": before_now(days=2)})
        )
        assert len(rows) == 2
        assert rows[1][1] == str(middle.id)

    @patch("sentry.preprod.builds_query.get_size_retention_cutoff")
    def test_excludes_expired_artifacts(self, mock_cutoff) -> None:
        mock_cutoff.return_value = before_now(days=30)
        self.create_preprod_artifact(app_id="recent.app", date_added=before_now(days=10))
        self.create_preprod_artifact(app_id="expired.app", date_added=before_now(days=60))

        rows = self._csv_rows(self._request({}))
        assert len(rows) == 2
        assert rows[1][2] == "recent.app"

    def test_results_ordered_newest_first(self) -> None:
        self.create_preprod_artifact(app_id="oldest.app", date_added=before_now(days=5))
        self.create_preprod_artifact(app_id="newest.app", date_added=before_now(days=1))
        rows = self._csv_rows(self._request({}))
        assert [r[2] for r in rows[1:]] == ["newest.app", "oldest.app"]

    # --- row limit ----------------------------------------------------------

    @patch("sentry.preprod.api.endpoints.builds_export.CSV_EXPORT_ROW_LIMIT", 2)
    def test_rejects_when_too_many_rows(self) -> None:
        for i in range(3):
            self.create_preprod_artifact(app_id=f"com.example.app{i}")
        response = self._request({})
        assert response.status_code == 400
        detail = response.json()["detail"]
        assert "too many builds" in detail.lower()
        # The actual total must not be leaked in the error message.
        assert "3" not in detail

    @patch("sentry.preprod.api.endpoints.builds_export.CSV_EXPORT_ROW_LIMIT", 2)
    def test_allows_count_at_limit(self) -> None:
        for i in range(2):
            self.create_preprod_artifact(app_id=f"com.example.app{i}")
        rows = self._csv_rows(self._request({}))
        assert len(rows) == 3  # header + 2 builds
