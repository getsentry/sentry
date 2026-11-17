from datetime import timedelta

from django.utils import timezone

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.timeseries_annotations.models import (
    AnnotationScope,
    AnnotationType,
    IntervalType,
    TimeseriesAnnotation,
)

FEATURE = "organizations:timeseries-annotations"


@with_feature(FEATURE)
class OrganizationTimeseriesAnnotationIndexTest(APITestCase):
    endpoint = "sentry-api-0-organization-timeseries-annotations"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def _annotation(self, **kwargs: object) -> TimeseriesAnnotation:
        values = dict(
            organization_id=self.organization.id,
            annotation_type=AnnotationType.INBOUND_FILTER_CHANGE,
            description="x",
            start_timestamp=before_now(days=1),
            created_by_label="system",
        )
        values.update(kwargs)
        return TimeseriesAnnotation.objects.create(**values)

    def test_requires_feature(self) -> None:
        with self.feature({FEATURE: False}):
            self.get_error_response(self.organization.slug, status_code=404)

    def test_lists_point_in_window(self) -> None:
        inside = self._annotation(start_timestamp=before_now(days=1))
        self._annotation(start_timestamp=before_now(days=30))  # outside 14d window
        response = self.get_success_response(self.organization.slug, statsPeriod="14d")
        assert [row["id"] for row in response.data] == [str(inside.id)]

    def test_range_spanning_window_included(self) -> None:
        # Starts before the window, ends after it: neither endpoint is inside, but it overlaps.
        spanning = self._annotation(
            interval_type=IntervalType.RANGE,
            annotation_type=AnnotationType.SENTRY_OUTAGE,
            start_timestamp=before_now(days=40),
            end_timestamp=timezone.now() + timedelta(days=1),
        )
        response = self.get_success_response(self.organization.slug, statsPeriod="14d")
        assert [row["id"] for row in response.data] == [str(spanning.id)]

    def test_ongoing_range_included(self) -> None:
        ongoing = self._annotation(
            interval_type=IntervalType.RANGE,
            annotation_type=AnnotationType.SENTRY_OUTAGE,
            start_timestamp=before_now(days=2),
            end_timestamp=None,
        )
        response = self.get_success_response(self.organization.slug, statsPeriod="14d")
        assert [row["id"] for row in response.data] == [str(ongoing.id)]

    def test_resolved_range_before_window_excluded(self) -> None:
        self._annotation(
            interval_type=IntervalType.RANGE,
            annotation_type=AnnotationType.SENTRY_OUTAGE,
            start_timestamp=before_now(days=40),
            end_timestamp=before_now(days=30),
        )
        response = self.get_success_response(self.organization.slug, statsPeriod="14d")
        assert response.data == []

    def test_sorted_by_start_ascending(self) -> None:
        older = self._annotation(start_timestamp=before_now(days=5))
        newer = self._annotation(start_timestamp=before_now(days=1))
        response = self.get_success_response(self.organization.slug, statsPeriod="14d")
        assert [row["id"] for row in response.data] == [str(older.id), str(newer.id)]

    def test_scope_filter(self) -> None:
        spans = self._annotation(scope=AnnotationScope.SPANS)
        self._annotation(scope=AnnotationScope.LOGS)
        response = self.get_success_response(
            self.organization.slug, statsPeriod="14d", scope="spans"
        )
        assert [row["id"] for row in response.data] == [str(spans.id)]

    def test_type_filter(self) -> None:
        outage = self._annotation(annotation_type=AnnotationType.SENTRY_OUTAGE)
        self._annotation(annotation_type=AnnotationType.INBOUND_FILTER_CHANGE)
        response = self.get_success_response(
            self.organization.slug, statsPeriod="14d", annotationType="sentry_outage"
        )
        assert [row["id"] for row in response.data] == [str(outage.id)]

    def test_invalid_scope_is_400(self) -> None:
        self.get_error_response(
            self.organization.slug, statsPeriod="14d", scope="bogus", status_code=400
        )

    def test_project_filter_includes_org_wide(self) -> None:
        project = self.create_project(organization=self.organization)
        project_scoped = self._annotation(project_id=project.id)
        org_wide = self._annotation(project_id=None)
        response = self.get_success_response(
            self.organization.slug, statsPeriod="14d", project=project.id
        )
        assert {row["id"] for row in response.data} == {str(project_scoped.id), str(org_wide.id)}

    def test_inaccessible_project_annotation_excluded(self) -> None:
        # Another member's private project the caller isn't on: its annotation must not leak,
        # but the org-wide one still shows.
        other_user = self.create_user()
        private_project = self.create_project(organization=self.organization, teams=[])
        self.create_team_membership(
            self.create_team(organization=self.organization), user=other_user
        )
        hidden = self._annotation(project_id=private_project.id)
        org_wide = self._annotation(project_id=None)
        response = self.get_success_response(self.organization.slug, statsPeriod="14d")
        ids = {row["id"] for row in response.data}
        assert str(org_wide.id) in ids
        assert str(hidden.id) not in ids

    def test_serialized_shape(self) -> None:
        annotation = self._annotation(
            scope=AnnotationScope.SPANS,
            tags={"filter": "legacy-browsers"},
            created_by_label="statuspage",
        )
        response = self.get_success_response(self.organization.slug, statsPeriod="14d")
        row = response.data[0]
        assert row["id"] == str(annotation.id)
        assert row["organizationId"] == str(self.organization.id)
        assert row["projectId"] is None
        assert row["intervalType"] == "point"
        assert row["annotationType"] == "inbound_filter_change"
        assert row["scope"] == "spans"
        assert row["tags"] == {"filter": "legacy-browsers"}
        assert row["createdBy"] is None
        assert row["createdByLabel"] == "statuspage"

    def test_serialized_user_creator(self) -> None:
        annotation = self._annotation(created_by_label=None, created_by_id=self.user.id)
        response = self.get_success_response(self.organization.slug, statsPeriod="14d")
        row = next(r for r in response.data if r["id"] == str(annotation.id))
        assert row["createdBy"] == {"type": "user", "id": str(self.user.id)}
        assert row["createdByLabel"] is None
