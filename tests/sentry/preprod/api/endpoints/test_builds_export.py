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
    "project_slug",
    "artifact_id",
    "app_id",
    "build_configuration",
    "version",
    "platform",
    "install_groups",
    "upload_date",
    "download_count",
]


def _col(row: list[str], name: str) -> str:
    """Look up a cell by column name so assertions don't hard-code column positions."""
    return row[EXPECTED_HEADER.index(name)]


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

    def _create_installable_build(self, **kwargs) -> PreprodArtifact:
        # Installable per is_installable_artifact(): an installable file (default APK,
        # so no iOS signature check applies). Tests that want a non-installable build
        # call create_preprod_artifact directly.
        kwargs.setdefault("installable_app_file_id", 1)
        kwargs.setdefault("build_number", 1)
        return self.create_preprod_artifact(**kwargs)

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
        disposition = response["Content-Disposition"]
        assert disposition.startswith(
            f'attachment; filename="{self.organization.slug}-build-distribution-'
        )
        assert disposition.endswith('.csv"')

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
            project_slug,
            artifact_id,
            app_id,
            build_configuration,
            version,
            platform,
            install_groups,
            upload_date,
            download_count,
        ) = rows[1]
        assert app_name == "My App"
        assert artifact_id == str(artifact.id)
        assert app_id == "com.example.app"
        assert build_configuration == ""  # none set -> blank
        assert version == "1.2.3"
        assert platform == "android"
        assert install_groups == "[]"  # none set -> empty JSON array
        assert upload_date  # ISO timestamp present
        assert download_count == "15"
        assert project_slug == self.project.slug

    def test_build_configuration_and_project_slug(self) -> None:
        # build_configuration sources from the (nullable) PreprodBuildConfiguration name;
        # project_slug from the build's project.
        config = self.create_preprod_build_configuration(name="Release")
        self._create_installable_build(app_id="com.example.cfg", build_configuration=config)
        row = self._csv_rows(self._request({}))[1]
        assert _col(row, "project_slug") == self.project.slug
        assert _col(row, "build_configuration") == "Release"

    def test_platform_apple(self) -> None:
        self._create_installable_build(
            app_id="com.example.ios",
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            extras={"is_code_signature_valid": True},  # iOS needs this to count as installable
        )
        rows = self._csv_rows(self._request({}))
        assert len(rows) == 2
        assert _col(rows[1], "platform") == "apple"

    def test_blank_optional_cells(self) -> None:
        # An installable build (file + build_number) with no app_name/build_version and
        # no build_configuration leaves those cells blank.
        self._create_installable_build(app_id="com.example.bare")
        rows = self._csv_rows(self._request({}))
        assert len(rows) == 2
        assert _col(rows[1], "app_name") == ""
        assert _col(rows[1], "app_id") == "com.example.bare"
        assert _col(rows[1], "version") == ""
        assert _col(rows[1], "build_configuration") == ""  # no PreprodBuildConfiguration
        assert _col(rows[1], "install_groups") == "[]"
        assert _col(rows[1], "download_count") == "0"
        assert _col(rows[1], "project_slug") == self.project.slug

    def test_formula_injection_escaped(self) -> None:
        # Leading formula triggers are neutralized with a quote — including when preceded
        # by whitespace or a tab that a spreadsheet would strip before evaluating.
        self._create_installable_build(app_id="evil.plain", app_name="=HYPERLINK(1)")
        self._create_installable_build(app_id="evil.space", app_name=" =HYPERLINK(1)")
        self._create_installable_build(app_id="evil.tab", app_name="\t=cmd")
        rows = self._csv_rows(self._request({}))
        by_app_id = {_col(r, "app_id"): _col(r, "app_name") for r in rows[1:]}
        assert by_app_id["evil.plain"] == "'=HYPERLINK(1)"
        assert by_app_id["evil.space"] == "' =HYPERLINK(1)"
        assert by_app_id["evil.tab"] == "'\t=cmd"

    def test_install_groups_json_encoded(self) -> None:
        self._create_installable_build(
            app_id="com.example.groups",
            extras={"install_groups": ["qa", "beta"]},
        )
        rows = self._csv_rows(self._request({}))
        # Emitted as a compact JSON array string, order preserved.
        assert _col(rows[1], "install_groups") == '["qa","beta"]'
        # ...and round-trips back to the original list.
        assert json.loads(_col(rows[1], "install_groups")) == ["qa", "beta"]

    # --- installability -----------------------------------------------------

    def test_excludes_non_installable_builds(self) -> None:
        # Matches the list/UI is_installable_artifact() definition: a build needs an
        # installable file (iOS also needs a valid, non-app-store signature). Builds
        # without a file, or iOS builds with an invalid signature, are omitted even
        # with downloads. A missing build_number does not exclude a build.
        installable = self._create_installable_build(app_id="com.example.installable")
        self.create_installable_preprod_artifact(installable, download_count=3)

        # Has an installable file but no build_number — still installable.
        no_build_number = self.create_preprod_artifact(
            app_id="com.example.nobuildnum", installable_app_file_id=2
        )
        self.create_installable_preprod_artifact(no_build_number, download_count=11)

        # No installable file at all.
        no_file = self.create_preprod_artifact(app_id="com.example.nofile")
        self.create_installable_preprod_artifact(no_file, download_count=7)

        # iOS build with file + build_number but an invalid code signature.
        bad_signature = self._create_installable_build(
            app_id="com.example.badsig",
            artifact_type=PreprodArtifact.ArtifactType.XCARCHIVE,
            extras={"is_code_signature_valid": False},
        )
        self.create_installable_preprod_artifact(bad_signature, download_count=13)

        rows = self._csv_rows(self._request({}))
        downloads_by_app_id = {_col(r, "app_id"): _col(r, "download_count") for r in rows[1:]}
        assert downloads_by_app_id == {
            "com.example.installable": "3",
            "com.example.nobuildnum": "11",
        }

    # --- filtering parity with the list endpoint ----------------------------

    def test_filter_by_query_app_id(self) -> None:
        self._create_installable_build(app_id="foo")
        self._create_installable_build(app_id="bar")
        rows = self._csv_rows(self._request({"query": "app_id:foo"}))
        assert len(rows) == 2
        assert _col(rows[1], "app_id") == "foo"

    def test_invalid_query_returns_400(self) -> None:
        self._create_installable_build(app_id="foo")
        response = self._request({"query": "no_such_key:foo"})
        assert response.status_code == 400
        assert response.json() == {"detail": "Invalid key for this search: no_such_key"}

    def test_bad_project(self) -> None:
        self._create_installable_build()
        response = self._request({"project": [1]})
        assert response.status_code == 403

    def test_build_in_another_project_excluded(self) -> None:
        another_project = self.create_project(name="Baz", slug="baz")
        self._create_installable_build(project=another_project)
        rows = self._csv_rows(self._request({"project": [self.project.id]}))
        assert rows == [EXPECTED_HEADER]

    def test_snapshot_builds_always_excluded(self) -> None:
        # The export is distribution-scoped; snapshot builds are excluded even when the
        # request asks for display=snapshot (the param is ignored).
        self._create_installable_build(app_id="com.regular.app")
        snapshot_artifact = self._create_installable_build(app_id="com.snapshot.app")
        self.create_preprod_snapshot_metrics(preprod_artifact=snapshot_artifact, image_count=5)

        rows = self._csv_rows(self._request({"display": "snapshot"}))
        assert len(rows) == 2
        assert _col(rows[1], "app_id") == "com.regular.app"

    def test_start_end_respected(self) -> None:
        self._create_installable_build(app_id="old.app", date_added=before_now(days=5))
        middle = self._create_installable_build(app_id="mid.app", date_added=before_now(days=3))
        self._create_installable_build(app_id="new.app", date_added=before_now(days=1))

        rows = self._csv_rows(
            self._request({"start": before_now(days=4), "end": before_now(days=2)})
        )
        assert len(rows) == 2
        assert _col(rows[1], "artifact_id") == str(middle.id)

    @patch("sentry.preprod.builds_query.get_size_retention_cutoff")
    def test_excludes_expired_artifacts(self, mock_cutoff) -> None:
        mock_cutoff.return_value = before_now(days=30)
        self._create_installable_build(app_id="recent.app", date_added=before_now(days=10))
        self._create_installable_build(app_id="expired.app", date_added=before_now(days=60))

        rows = self._csv_rows(self._request({}))
        assert len(rows) == 2
        assert _col(rows[1], "app_id") == "recent.app"

    def test_results_ordered_newest_first(self) -> None:
        self._create_installable_build(app_id="oldest.app", date_added=before_now(days=5))
        self._create_installable_build(app_id="newest.app", date_added=before_now(days=1))
        rows = self._csv_rows(self._request({}))
        assert [_col(r, "app_id") for r in rows[1:]] == ["newest.app", "oldest.app"]

    # --- row limit ----------------------------------------------------------

    @patch("sentry.preprod.api.endpoints.builds_export.CSV_EXPORT_ROW_LIMIT", 2)
    def test_rejects_when_too_many_rows(self) -> None:
        for i in range(3):
            self._create_installable_build(app_id=f"com.example.app{i}")
        response = self._request({})
        assert response.status_code == 400
        # ValidationError serializes to a list of messages; both count and limit appear.
        body = str(response.json())
        assert "3" in body
        assert "2" in body

    @patch("sentry.preprod.api.endpoints.builds_export.CSV_EXPORT_ROW_LIMIT", 2)
    def test_allows_count_at_limit(self) -> None:
        for i in range(2):
            self._create_installable_build(app_id=f"com.example.app{i}")
        rows = self._csv_rows(self._request({}))
        assert len(rows) == 3  # header + 2 builds
