from collections.abc import Generator
from unittest.mock import patch

import pytest
from django.db.models import Q
from jsonschema import ValidationError

from sentry.constants import ObjectStatus
from sentry.grouping.grouptype import ErrorDetectorHandler, ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.issues.grouptype import get_group_type_by_slug
from sentry.models.project import Project
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.workflow_engine.defaults.detectors import ensure_default_all_projects_detector
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.models.detector import get_detector_project_type_cache_key
from sentry.workflow_engine.registry import detector_settings_registry
from sentry.workflow_engine.types import DetectorPriorityLevel, DetectorSettings, DetectorType
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class DetectorTest(BaseWorkflowTest):
    def setUp(self) -> None:
        self.detector = self.create_detector()

    def test_queryset(self) -> None:
        """
        Test that we filter out objects with statuses other than 'active'
        """
        assert Detector.objects.filter(id=self.detector.id).exists()
        self.detector.status = ObjectStatus.PENDING_DELETION
        self.detector.save()
        assert not Detector.objects.filter(id=self.detector.id).exists()

        self.detector.status = ObjectStatus.DELETION_IN_PROGRESS
        self.detector.save()
        assert not Detector.objects.filter(id=self.detector.id).exists()

    @override_options({"workflow_engine.auto_creation.all_projects_detector": True})
    def test_detectors_by_organization(self) -> None:
        project_detector = self.create_detector(project=self.project)
        all_projects_detector = ensure_default_all_projects_detector(self.organization.id)
        result = list(Detector.objects.by_organization(self.organization.id))
        assert project_detector in result
        assert all_projects_detector in result

    @override_options({"workflow_engine.auto_creation.all_projects_detector": True})
    def test_excludes_other_organizations(self) -> None:
        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        other_project_detector = self.create_detector(project=other_project)
        other_all_projects_detector = ensure_default_all_projects_detector(other_org.id)
        result = list(Detector.objects.by_organization(self.organization.id))
        assert other_project_detector not in result
        assert other_all_projects_detector not in result

    def test_get_conditions__cached(self) -> None:
        self.detector.workflow_condition_group = self.create_data_condition_group()
        self.detector.save()

        self.create_data_condition(
            type="eq",
            comparison="HIGH",
            condition_group=self.detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        fetched_detector = (
            Detector.objects.filter(id=self.detector.id)
            .select_related("workflow_condition_group")
            .prefetch_related("workflow_condition_group__conditions")
            .first()
        )

        assert fetched_detector is not None
        with self.assertNumQueries(0):
            conditions = fetched_detector.get_conditions()
            assert conditions

    def test_get_conditions__cached_group_only(self) -> None:
        self.detector.workflow_condition_group = self.create_data_condition_group()
        self.detector.save()
        self.create_data_condition(
            type="eq",
            comparison="HIGH",
            condition_group=self.detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        fetched_detector = (
            Detector.objects.filter(id=self.detector.id)
            .select_related("workflow_condition_group")
            .first()
        )

        assert fetched_detector is not None
        with self.assertNumQueries(1):
            conditions = fetched_detector.get_conditions()
            assert conditions

    def test_get_conditions__not_cached(self) -> None:
        self.detector.workflow_condition_group = self.create_data_condition_group()
        self.detector.save()

        self.create_data_condition(
            type="eq",
            comparison="HIGH",
            condition_group=self.detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        fetched_detector = Detector.objects.get(id=self.detector.id)
        with self.assertNumQueries(1):
            conditions = fetched_detector.get_conditions()
            assert conditions

    def test_get_error_detector_for_project__success(self) -> None:
        """Test successful retrieval of error detector for project, created by default on project creation"""
        error_detector = self.create_detector(
            project=self.project, type=ErrorGroupType.slug, name="Error Detector"
        )  # this creates / fetches the single default error detector for the project
        result = Detector.get_error_detector_for_project(self.project.id)

        assert result == error_detector
        assert result.type == ErrorGroupType.slug
        assert result.project_id == self.project.id

    def test_get_error_detector_for_project__not_found(self) -> None:
        self.create_detector(
            project=self.project, type=ErrorGroupType.slug, name="Error Detector"
        ).delete()  # delete the single default error detector for the project
        with pytest.raises(Detector.DoesNotExist):
            Detector.get_error_detector_for_project(self.project.id)

    def test_get_error_detector_for_project__caching(self) -> None:
        error_detector = self.create_detector(
            project=self.project, type=ErrorGroupType.slug, name="Error Detector"
        )

        # First call - cache miss
        with (
            patch("sentry.workflow_engine.models.detector.cache.get") as mock_cache_get,
            patch("sentry.workflow_engine.models.detector.cache.set") as mock_cache_set,
        ):
            mock_cache_get.return_value = None

            result = Detector.get_error_detector_for_project(self.project.id)

            assert result == error_detector

            # Verify cache key format using the new method
            expected_cache_key = get_detector_project_type_cache_key(
                self.project.id, ErrorGroupType.slug
            )
            mock_cache_get.assert_called_once_with(expected_cache_key)
            mock_cache_set.assert_called_once_with(
                expected_cache_key, error_detector, Detector.CACHE_TTL
            )

    def test_get_error_detector_for_project__cache_hit(self) -> None:
        error_detector = self.create_detector(
            project=self.project, type=ErrorGroupType.slug, name="Error Detector"
        )

        # Mock cache hit
        with patch("sentry.workflow_engine.models.detector.cache.get") as mock_cache_get:
            mock_cache_get.return_value = error_detector

            result = Detector.get_error_detector_for_project(self.project.id)

            assert result == error_detector

            # Verify cache was checked with correct key
            expected_cache_key = get_detector_project_type_cache_key(
                self.project.id, ErrorGroupType.slug
            )
            mock_cache_get.assert_called_once_with(expected_cache_key)

    def test_settings(self) -> None:
        detector = self.create_detector()
        assert detector.settings


def test_get_detector_project_type_cache_key() -> None:
    project_id = 123
    detector_type = "error"

    cache_key = get_detector_project_type_cache_key(project_id, detector_type)

    assert cache_key == f"detector:by_proj_type:{project_id}:{detector_type}"


@pytest.mark.parametrize("detector_type", list(DetectorType))
def test_detector_type_registration_supports_string_lookup(detector_type: DetectorType) -> None:
    # Startup must load every declared implementation; callers still pass stored/API strings.
    assert detector_settings_registry.get(detector_type.value) is detector_settings_registry.get(
        detector_type
    )


@django_db_all
def test_detector_type_enum_preserves_stored_value(
    factories: Factories, default_project: Project
) -> None:
    detector = factories.create_detector(project=default_project, type=DetectorType.METRIC)

    detector.refresh_from_db()

    assert type(detector.type) is str
    assert detector.type == "metric_issue"
    assert detector.settings is detector_settings_registry.get(DetectorType.METRIC)


@pytest.fixture
def registry_only_settings() -> Generator[type[DetectorSettings]]:
    class RegistryOnlySettings(DetectorSettings):
        handler = ErrorDetectorHandler
        config_schema = {
            "type": "object",
            "properties": {"value": {"type": "number"}, "visible": {"type": "boolean"}},
            "required": ["value"],
            "additionalProperties": False,
        }
        filter = Q(config__visible=True)

    with patch.dict(detector_settings_registry.registrations):
        detector_settings_registry.register("registry_only_detector")(RegistryOnlySettings)
        yield RegistryOnlySettings


@django_db_all
def test_detector_settings_and_handler_without_group_type(
    factories: Factories,
    default_project: Project,
    registry_only_settings: type[DetectorSettings],
) -> None:
    assert get_group_type_by_slug("registry_only_detector") is None
    detector = factories.create_detector(
        project=default_project,
        type="registry_only_detector",
        config={"value": 10, "visible": True},
    )

    detector.refresh_from_db()
    assert detector.settings is registry_only_settings
    handler = detector.detector_handler
    assert isinstance(handler, ErrorDetectorHandler)
    assert handler.detector == detector

    detector.config = {"value": "invalid"}
    with pytest.raises(ValidationError, match="Invalid config"):
        detector.save()

    detector.refresh_from_db()
    assert detector.config == {"value": 10, "visible": True}


@pytest.mark.parametrize(
    ("config", "error"),
    [
        ([], "Detector config must be a dictionary"),
        ({}, "Invalid config"),
        ({"value": 10, "unexpected": True}, "Invalid config"),
    ],
)
def test_registry_only_detector_validates_config(
    registry_only_settings: type[DetectorSettings], config: object, error: str
) -> None:
    detector = Detector(type="registry_only_detector", config=config)

    with pytest.raises(ValidationError, match=error):
        detector.enforce_config_schema()


@pytest.mark.parametrize("detector_type", ["unregistered_detector", "feedback"])
def test_group_type_without_detector_registration_is_rejected(detector_type: str) -> None:
    detector = Detector(type=detector_type, config={})

    with pytest.raises(ValueError, match=f"Detector type '{detector_type}' not registered"):
        detector.enforce_config_schema()


@django_db_all
def test_registry_only_detector_filters(
    factories: Factories,
    default_project: Project,
    registry_only_settings: type[DetectorSettings],
) -> None:
    visible = factories.create_detector(
        project=default_project,
        type="registry_only_detector",
        config={"value": 1, "visible": True},
    )
    hidden = factories.create_detector(
        project=default_project,
        type="registry_only_detector",
        config={"value": 2, "visible": False},
    )
    unfiltered = factories.create_detector(project=default_project, type=MetricIssue.slug)

    detector_ids = set(
        Detector.objects.with_type_filters()
        .filter(id__in=[visible.id, hidden.id, unfiltered.id])
        .values_list("id", flat=True)
    )

    assert detector_ids == {visible.id, unfiltered.id}


@pytest.mark.parametrize(
    "detector_type",
    [
        "performance_slow_db_query",
        "performance_large_http_payload",
        "query_injection_vulnerability",
    ],
)
@pytest.mark.parametrize("config", [{}, {"duration_threshold": 5000}, [], "legacy-config"])
def test_performance_detector_settings_preserve_legacy_validation(
    detector_type: str, config: object
) -> None:
    # Do not import issue_detection.grouptype here: startup must load these registrations.
    detector = Detector(type=detector_type, config=config)

    detector.enforce_config_schema()

    assert detector.settings.handler is None
    assert detector.settings.validator is None
    assert detector.settings.config_schema is None
    assert detector.detector_handler is None
