import orjson
from django.test import override_settings

from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.testutils.auth import generate_service_request_signature
from sentry.testutils.cases import TestCase

SHARED_SECRET_FOR_TESTS = "test-secret-key"


class ProjectPreprodSizeEndpointTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.file = self.create_file(name="test_artifact.apk", type="application/octet-stream")
        self.artifact = self.create_preprod_artifact(
            project=self.project,
            file_id=self.file.id,
            state=PreprodArtifact.ArtifactState.UPLOADING,
        )

    def _put(self, data, identifier=None, secret=SHARED_SECRET_FOR_TESTS):
        if identifier:
            url = f"/api/0/internal/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{self.artifact.id}/size/{identifier}/"
        else:
            url = f"/api/0/internal/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{self.artifact.id}/size/"
        signature = generate_service_request_signature(url, data, [secret], "Launchpad")
        return self.client.put(
            url,
            data=data,
            content_type="application/json",
            HTTP_AUTHORIZATION=f"rpcsignature {signature}",
        )

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    def test_bad_auth(self) -> None:
        response = self._put(b"{}", secret="wrong secret")
        assert response.status_code == 401

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    def test_missing_fields(self) -> None:
        response = self._put(b"{}")
        assert response.status_code == 400

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    def test_bad_json(self) -> None:
        response = self._put(b"{")
        assert response.status_code == 400

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    def test_invalid_state(self) -> None:
        response = self._put(orjson.dumps({"state": 999}))
        assert response.status_code == 400

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    def test_bad_auth_with_identifier(self) -> None:
        response = self._put(b"{}", identifier="some_feature", secret="wrong secret")
        assert response.status_code == 401

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    def test_bad_json_with_identifier(self) -> None:
        response = self._put(b"{", identifier="some_feature")
        assert response.status_code == 400

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    def test_missing_fields_with_identifier(self) -> None:
        response = self._put(b"{}", identifier="some_feature")
        assert response.status_code == 400

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    def test_invalid_state_with_identifier(self) -> None:
        response = self._put(orjson.dumps({"state": 999}), identifier="some_feature")
        assert response.status_code == 400

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    def test_mark_as_failed(self) -> None:
        self.create_preprod_artifact_size_metrics(self.artifact)

        response = self._put(
            orjson.dumps({"state": 3, "error_code": 2, "error_message": "detailed reason"})
        )

        metrics = PreprodArtifactSizeMetrics.objects.get(preprod_artifact=self.artifact)

        assert response.status_code == 200
        assert metrics.state == PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED
        assert metrics.error_code == 2
        assert metrics.error_message == "detailed reason"

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    def test_mark_as_failed_with_identifier(self) -> None:
        self.create_preprod_artifact_size_metrics(self.artifact, identifier="some_feature")

        response = self._put(
            orjson.dumps({"state": 3, "error_code": 3, "error_message": "another detailed reason"}),
            identifier="some_feature",
        )

        metrics = PreprodArtifactSizeMetrics.objects.get(
            preprod_artifact=self.artifact, identifier="some_feature"
        )
        assert response.status_code == 200
        assert metrics.state == PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED
        assert metrics.error_code == 3
        assert metrics.error_message == "another detailed reason"

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    def test_mark_as_failed_multiple(self) -> None:
        self.create_preprod_artifact_size_metrics(self.artifact, identifier="some_feature")
        self.create_preprod_artifact_size_metrics(self.artifact)

        self._put(orjson.dumps({"state": 3, "error_code": 2, "error_message": "detailed reason"}))

        metrics = PreprodArtifactSizeMetrics.objects.get(
            preprod_artifact=self.artifact, identifier__isnull=True
        )
        assert metrics.state == PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    def test_will_create_with_identifier(self) -> None:
        self._put(
            orjson.dumps({"state": 3, "error_code": 2, "error_message": "detailed reason"}),
            identifier="some_feature",
        )

        metrics = PreprodArtifactSizeMetrics.objects.get(
            preprod_artifact=self.artifact, identifier="some_feature"
        )
        assert metrics.state == PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    def test_will_create(self) -> None:
        self.create_preprod_artifact_size_metrics(self.artifact, identifier="wrong_one")

        self._put(orjson.dumps({"state": 3, "error_code": 2, "error_message": "detailed reason"}))

        metrics = PreprodArtifactSizeMetrics.objects.get(
            preprod_artifact=self.artifact, identifier__isnull=True
        )
        assert metrics.state == PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    def test_pending(self) -> None:
        self.create_preprod_artifact_size_metrics(self.artifact)

        self._put(orjson.dumps({"state": 0}))

        metrics = PreprodArtifactSizeMetrics.objects.get(preprod_artifact=self.artifact)
        assert metrics.state == PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    def test_processing(self) -> None:
        self.create_preprod_artifact_size_metrics(self.artifact)

        self._put(orjson.dumps({"state": 1}))

        metrics = PreprodArtifactSizeMetrics.objects.get(preprod_artifact=self.artifact)
        assert metrics.state == PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    def test_requires_launchpad_rpc_authentication(self) -> None:
        self.login_as(self.user)

        url = f"/api/0/internal/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{self.artifact.id}/size/"
        response = self.client.put(
            url,
            data=orjson.dumps({"state": 1}),
            content_type="application/json",
        )

        assert response.status_code == 401

    @override_settings(LAUNCHPAD_RPC_SHARED_SECRET=[SHARED_SECRET_FOR_TESTS])
    def test_requires_launchpad_rpc_authentication_with_identifier(self) -> None:
        self.login_as(self.user)

        url = f"/api/0/internal/{self.organization.slug}/{self.project.slug}/files/preprodartifacts/{self.artifact.id}/size/some_feature/"
        response = self.client.put(
            url,
            data=orjson.dumps({"state": 1}),
            content_type="application/json",
        )

        assert response.status_code == 401
