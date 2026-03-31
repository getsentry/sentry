from datetime import timedelta

from django.utils import timezone

from sentry.preprod.artifact_search import get_sequential_base_artifact
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics
from sentry.testutils.cases import TestCase


class GetSequentialBaseArtifactTest(TestCase):
    def _create_artifact_with_metrics(
        self,
        app_id="com.example.app",
        artifact_type=PreprodArtifact.ArtifactType.APK,
        build_configuration=None,
        date_added=None,
        state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED,
        app_name=None,
        **kwargs,
    ):
        artifact = self.create_preprod_artifact(
            project=self.project,
            app_id=app_id,
            artifact_type=artifact_type,
            build_configuration=build_configuration,
            date_added=date_added,
            app_name=app_name,
            **kwargs,
        )
        self.create_preprod_artifact_size_metrics(
            artifact,
            metrics_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier=None,
            max_install_size=1000,
            max_download_size=500,
            state=state,
        )
        return artifact

    def test_returns_most_recent_matching_artifact(self) -> None:
        now = timezone.now()
        oldest = self._create_artifact_with_metrics(date_added=now - timedelta(hours=3))
        middle = self._create_artifact_with_metrics(date_added=now - timedelta(hours=2))
        head = self._create_artifact_with_metrics(date_added=now - timedelta(hours=1))

        result = get_sequential_base_artifact(head, "", self.organization)
        assert result is not None
        assert result.id == middle.id
        assert result.id != oldest.id

    def test_returns_none_when_no_prior_artifact(self) -> None:
        head = self._create_artifact_with_metrics()

        result = get_sequential_base_artifact(head, "", self.organization)
        assert result is None

    def test_excludes_self(self) -> None:
        head = self._create_artifact_with_metrics()

        result = get_sequential_base_artifact(head, "", self.organization)
        assert result is None

    def test_requires_completed_size_metrics(self) -> None:
        self._create_artifact_with_metrics(
            state=PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
            date_added=timezone.now() - timedelta(hours=2),
        )
        head = self._create_artifact_with_metrics(
            date_added=timezone.now() - timedelta(hours=1),
        )

        result = get_sequential_base_artifact(head, "", self.organization)
        assert result is None

    def test_matches_on_app_id(self) -> None:
        self._create_artifact_with_metrics(
            app_id="com.other.app",
            date_added=timezone.now() - timedelta(hours=2),
        )
        head = self._create_artifact_with_metrics(
            app_id="com.example.app",
            date_added=timezone.now() - timedelta(hours=1),
        )

        result = get_sequential_base_artifact(head, "", self.organization)
        assert result is None

    def test_matches_on_artifact_type(self) -> None:
        self._create_artifact_with_metrics(
            artifact_type=PreprodArtifact.ArtifactType.AAB,
            date_added=timezone.now() - timedelta(hours=2),
        )
        head = self._create_artifact_with_metrics(
            artifact_type=PreprodArtifact.ArtifactType.APK,
            date_added=timezone.now() - timedelta(hours=1),
        )

        result = get_sequential_base_artifact(head, "", self.organization)
        assert result is None

    def test_matches_on_build_configuration(self) -> None:
        config_release = self.create_preprod_build_configuration(
            project=self.project, name="release"
        )
        config_debug = self.create_preprod_build_configuration(project=self.project, name="debug")

        self._create_artifact_with_metrics(
            build_configuration=config_debug,
            date_added=timezone.now() - timedelta(hours=2),
        )
        head = self._create_artifact_with_metrics(
            build_configuration=config_release,
            date_added=timezone.now() - timedelta(hours=1),
        )

        result = get_sequential_base_artifact(head, "", self.organization)
        assert result is None

    def test_applies_query_filter(self) -> None:
        now = timezone.now()
        # This one matches the query
        matching = self._create_artifact_with_metrics(
            app_name="MyApp",
            date_added=now - timedelta(hours=3),
        )
        # This one does not match the query
        self._create_artifact_with_metrics(
            app_name="OtherApp",
            date_added=now - timedelta(hours=2),
        )
        head = self._create_artifact_with_metrics(
            app_name="MyApp",
            date_added=now - timedelta(hours=1),
        )

        result = get_sequential_base_artifact(head, "app_name:MyApp", self.organization)
        assert result is not None
        assert result.id == matching.id

    def test_empty_query_matches_all(self) -> None:
        now = timezone.now()
        base = self._create_artifact_with_metrics(date_added=now - timedelta(hours=2))
        head = self._create_artifact_with_metrics(date_added=now - timedelta(hours=1))

        result = get_sequential_base_artifact(head, "", self.organization)
        assert result is not None
        assert result.id == base.id

    def test_handles_null_build_configuration(self) -> None:
        now = timezone.now()
        base = self._create_artifact_with_metrics(
            build_configuration=None,
            date_added=now - timedelta(hours=2),
        )
        head = self._create_artifact_with_metrics(
            build_configuration=None,
            date_added=now - timedelta(hours=1),
        )

        result = get_sequential_base_artifact(head, "", self.organization)
        assert result is not None
        assert result.id == base.id
