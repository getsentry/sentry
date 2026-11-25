from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import patch

from sentry.flags.models import ACTION_MAP, PROVIDER_MAP, FlagAuditLogModel
from sentry.models.environment import Environment
from sentry.testutils.cases import TestCase
from sentry.timeseries_annotations.models import (
    AnnotationScope,
    AnnotationType,
    IntervalType,
    Severity,
    TimeseriesAnnotation,
)
from sentry.timeseries_annotations.producers.feature_flag_change import (
    build_feature_flag_annotation_description,
    record_feature_flag_change_as_annotation,
)

# --- description construction (fixture-backed rules) -----------------------


def test_description_prefers_changelog_over_purpose() -> None:
    # LD fixtures: tags.description is change text; flag_description is purpose.
    assert (
        build_feature_flag_annotation_description(
            flag="test flag",
            action="created",
            provider="launchdarkly",
            tags={
                "description": "flag was created",
                "flag_description": "testing a feature flag",
            },
        )
        == "flag was created"
    )


def test_description_falls_back_to_purpose() -> None:
    assert (
        build_feature_flag_annotation_description(
            flag="test-flag",
            action="created",
            provider="unleash",
            tags={"flag_description": "Controls checkout redesign rollout"},
        )
        == "Controls checkout redesign rollout"
    )


def test_description_constructs_from_unleash_change_type_and_env() -> None:
    # Unleash fixtures often have no purpose/changelog — construct from attributes.
    assert (
        build_feature_flag_annotation_description(
            flag="test-flag",
            action="updated",
            provider="unleash",
            tags={
                "change_type": "feature-environment-enabled",
                "environment": "development",
                "project": "default",
            },
        )
        == "Feature flag 'test-flag' updated via Unleash (feature-environment-enabled) in development"
    )


def test_description_constructs_with_ld_on_state() -> None:
    assert (
        build_feature_flag_annotation_description(
            flag="test flag",
            action="updated",
            provider="launchdarkly",
            tags={"change_type": "updateOn", "environment": "test", "on": "true"},
        )
        == "Feature flag 'test flag' updated via LaunchDarkly (updateOn) in test — targeting on"
    )


def test_description_statsig_uses_changelog() -> None:
    # Statsig fixtures: metadata.description → tags.description.
    assert (
        build_feature_flag_annotation_description(
            flag="gate1",
            action="updated",
            provider="statsig",
            tags={
                "description": "Updated Config Conditions\n    - Added rule Rule 1",
                "change_type": "Gate",
            },
        )
        == "Updated Config Conditions\n    - Added rule Rule 1"
    )


def test_description_truncates_long_changelog() -> None:
    long = "x" * 600
    result = build_feature_flag_annotation_description(
        flag="f", action="updated", provider="generic", tags={"description": long}
    )
    assert len(result) == 500
    assert result.endswith("...")


# --- producer --------------------------------------------------------------


class FeatureFlagChangeProducerTest(TestCase):
    def _create_flag_log(self, **overrides: object) -> FlagAuditLogModel:
        defaults: dict[str, object] = {
            "action": ACTION_MAP["updated"],
            "created_at": datetime(2024, 12, 30, tzinfo=timezone.utc),
            "created_by": "user@example.com",
            "created_by_type": 0,
            "flag": "checkout-redesign",
            "organization_id": self.organization.id,
            "provider": PROVIDER_MAP["launchdarkly"],
            "tags": {
                "description": "* Turned the flag on",
                "flag_description": "Controls checkout redesign",
                "change_type": "updateOn",
                "environment": "production",
                "on": "true",
            },
        }
        defaults.update(overrides)
        return FlagAuditLogModel.objects.create(**defaults)

    def test_skipped_when_usecase_flag_off(self) -> None:
        flag_log = self._create_flag_log()
        record_feature_flag_change_as_annotation(flag_log)
        assert TimeseriesAnnotation.objects.count() == 0

    def test_creates_annotation_when_flag_on(self) -> None:
        env = Environment.get_or_create(project=self.project, name="production")
        flag_log = self._create_flag_log()

        with self.feature("organizations:timeseries-annotations-usecase-feature-flag-change"):
            record_feature_flag_change_as_annotation(flag_log)

        assert TimeseriesAnnotation.objects.count() == 1
        ann = TimeseriesAnnotation.objects.get()
        assert ann.organization_id == self.organization.id
        assert ann.annotation_type == AnnotationType.FEATURE_FLAG_CHANGE
        assert ann.scope == AnnotationScope.GLOBAL
        assert ann.severity == Severity.LOW
        assert ann.interval_type == IntervalType.POINT
        assert ann.description == "* Turned the flag on"
        assert ann.start_timestamp == flag_log.created_at
        assert ann.end_timestamp is None
        assert ann.created_by_label == "feature-flag-webhook"
        assert ann.created_by_id is None
        assert ann.environment_id == env.id
        assert ann.tags is not None
        assert ann.tags["flag"] == "checkout-redesign"
        assert ann.tags["action"] == "updated"
        assert ann.tags["provider"] == "launchdarkly"
        assert ann.tags["flag_log_id"] == str(flag_log.id)
        assert ann.tags["flag_description"] == "Controls checkout redesign"
        assert ann.tags["change_description"] == "* Turned the flag on"
        assert ann.tags["change_type"] == "updateOn"

    def test_resolves_project_by_slug_when_present(self) -> None:
        flag_log = self._create_flag_log(
            provider=PROVIDER_MAP["unleash"],
            tags={
                "change_type": "feature-environment-enabled",
                "project": self.project.slug,
                "environment": "development",
            },
        )
        with self.feature("organizations:timeseries-annotations-usecase-feature-flag-change"):
            record_feature_flag_change_as_annotation(flag_log)

        ann = TimeseriesAnnotation.objects.get()
        assert ann.project_id == self.project.id
        assert ann.description.startswith("Feature flag 'checkout-redesign' updated via Unleash")

    def test_write_path_fans_out_after_bulk_create(self) -> None:
        from sentry.flags.providers import write

        with self.feature("organizations:timeseries-annotations-usecase-feature-flag-change"):
            write(
                [
                    {
                        "action": ACTION_MAP["created"],
                        "created_at": datetime(2024, 12, 12, tzinfo=timezone.utc),
                        "created_by": "user",
                        "created_by_type": 2,
                        "flag": "hello",
                        "organization_id": self.organization.id,
                        "provider": PROVIDER_MAP["generic"],
                        "tags": {"flag_description": "Hello world gate"},
                    }
                ]
            )

        assert FlagAuditLogModel.objects.count() == 1
        assert TimeseriesAnnotation.objects.count() == 1
        ann = TimeseriesAnnotation.objects.get()
        assert ann.description == "Hello world gate"
        assert ann.tags["provider"] == "generic"
        assert ann.tags["flag_log_id"] == str(FlagAuditLogModel.objects.get().id)

    def test_annotation_failure_does_not_break_flag_log_write(self) -> None:
        from sentry.flags.providers import write

        with (
            self.feature("organizations:timeseries-annotations-usecase-feature-flag-change"),
            patch(
                "sentry.timeseries_annotations.producers.feature_flag_change.create_timeseries_annotation",
                side_effect=RuntimeError("boom"),
            ),
        ):
            write(
                [
                    {
                        "action": ACTION_MAP["created"],
                        "created_at": datetime(2024, 12, 12, tzinfo=timezone.utc),
                        "created_by": "user",
                        "created_by_type": 2,
                        "flag": "hello",
                        "organization_id": self.organization.id,
                        "provider": PROVIDER_MAP["generic"],
                        "tags": {},
                    }
                ]
            )

        assert FlagAuditLogModel.objects.count() == 1
        assert TimeseriesAnnotation.objects.count() == 0
