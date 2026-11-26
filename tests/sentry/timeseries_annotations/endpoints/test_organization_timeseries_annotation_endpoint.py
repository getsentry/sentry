from datetime import timedelta
from math import log1p

from django.utils import timezone

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.timeseries_annotations.models import (
    AnnotationScope,
    AnnotationType,
    IntervalType,
    Severity,
    TimeseriesAnnotation,
)
from sentry.utils.cache import cache


@with_feature("organizations:timeseries-annotations")
class OrganizationTimeseriesAnnotationEndpointTest(APITestCase):
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

    def test_severity_filter(self) -> None:
        high = self._annotation(severity=Severity.HIGH)
        self._annotation(severity=Severity.LOW)
        response = self.get_success_response(
            self.organization.slug, statsPeriod="14d", severity="high"
        )
        assert [row["id"] for row in response.data] == [str(high.id)]

    def test_invalid_severity_is_400(self) -> None:
        self.get_error_response(
            self.organization.slug, statsPeriod="14d", severity="bogus", status_code=400
        )

    def test_environment_filter_includes_env_wide(self) -> None:
        project = self.create_project(organization=self.organization)
        env = self.create_environment(project=project, name="prod")
        env_scoped = self._annotation(environment_id=env.id)
        env_wide = self._annotation(environment_id=None)
        self._annotation(environment_id=self.create_environment(project=project, name="dev").id)
        response = self.get_success_response(
            self.organization.slug, statsPeriod="14d", environment="prod"
        )
        assert {row["id"] for row in response.data} == {str(env_scoped.id), str(env_wide.id)}

    def test_unknown_environment_is_404(self) -> None:
        self.get_error_response(
            self.organization.slug, statsPeriod="14d", environment="nope", status_code=404
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
        env = self.create_environment(
            project=self.create_project(organization=self.organization), name="prod"
        )
        annotation = self._annotation(
            scope=AnnotationScope.SPANS,
            severity=Severity.HIGH,
            environment_id=env.id,
            tags={"filter": "legacy-browsers"},
            created_by_label="statuspage",
        )
        response = self.get_success_response(self.organization.slug, statsPeriod="14d")
        row = response.data[0]
        assert row["id"] == str(annotation.id)
        assert row["organizationId"] == str(self.organization.id)
        assert row["projectId"] is None
        assert row["environmentId"] == str(env.id)
        assert row["intervalType"] == "point"
        assert row["annotationType"] == "inbound_filter_change"
        assert row["scope"] == "spans"
        assert row["severity"] == "high"
        assert row["pinned"] is False
        assert row["tags"] == {"filter": "legacy-browsers"}
        assert row["createdBy"] is None
        assert row["createdByLabel"] == "statuspage"

    def test_serialized_pinned(self) -> None:
        annotation = self._annotation(pinned=True)
        response = self.get_success_response(self.organization.slug, statsPeriod="14d")
        row = next(r for r in response.data if r["id"] == str(annotation.id))
        assert row["pinned"] is True

    def test_serialized_user_creator(self) -> None:
        annotation = self._annotation(created_by_label=None, created_by_id=self.user.id)
        response = self.get_success_response(self.organization.slug, statsPeriod="14d")
        row = next(r for r in response.data if r["id"] == str(annotation.id))
        assert row["createdBy"] == {"type": "user", "id": str(self.user.id)}
        assert row["createdByLabel"] is None

    def test_excludes_expired_past_retention(self) -> None:
        # Request window reaches back a year, but 30d retention is what gates visibility.
        # Effective end is end_timestamp for a resolved range, else start_timestamp; an open
        # range dangling past retention is deleted, so it reads as expired too.
        fresh_point = self._annotation(start_timestamp=before_now(days=10))
        self._annotation(start_timestamp=before_now(days=40))  # expired on its start
        live_range = self._annotation(
            interval_type=IntervalType.RANGE,
            start_timestamp=before_now(days=40),
            end_timestamp=before_now(days=10),  # ended inside retention
        )
        self._annotation(
            interval_type=IntervalType.RANGE,
            start_timestamp=before_now(days=60),
            end_timestamp=before_now(days=40),  # ended before retention: expired
        )
        open_fresh = self._annotation(
            interval_type=IntervalType.RANGE,
            start_timestamp=before_now(days=5),
            end_timestamp=None,  # open, started inside retention
        )
        self._annotation(
            interval_type=IntervalType.RANGE,
            start_timestamp=before_now(days=50),
            end_timestamp=None,  # open and dangling past retention: expired
        )
        with self.options({"system.event-retention-days": 30}):
            response = self.get_success_response(
                self.organization.slug,
                start=before_now(days=365).isoformat(),
                end=timezone.now().isoformat(),
            )
        assert {row["id"] for row in response.data} == {
            str(fresh_point.id),
            str(live_range.id),
            str(open_fresh.id),
        }

    def test_attaches_rarity_without_changing_severity(self) -> None:
        cache.delete(f"ta:rarity-counts:v1:{self.organization.id}")
        rare = self._annotation(
            annotation_type=AnnotationType.CUSTOM,
            severity=Severity.LOW,
            start_timestamp=before_now(days=1),
        )
        for days_ago in (2, 3, 4, 5, 6):
            self._annotation(
                annotation_type=AnnotationType.INBOUND_FILTER_CHANGE,
                severity=Severity.HIGH,
                start_timestamp=before_now(days=days_ago),
            )
        common = self._annotation(
            annotation_type=AnnotationType.INBOUND_FILTER_CHANGE,
            severity=Severity.HIGH,
            start_timestamp=before_now(hours=12),
        )

        with self.options({"system.event-retention-days": 90}):
            response = self.get_success_response(self.organization.slug, statsPeriod="14d")

        by_id = {row["id"]: row for row in response.data}
        rare_row = by_id[str(rare.id)]
        common_row = by_id[str(common.id)]

        assert rare_row["severity"] == "low"
        assert common_row["severity"] == "high"
        assert rare_row["rarityWindowDays"] == 90
        assert common_row["rarityWindowDays"] == 90
        assert rare_row["rarityScore"] == 1.0 / (1.0 + log1p(1))
        assert common_row["rarityScore"] == 1.0 / (1.0 + log1p(6))
        assert rare_row["rarityScore"] > common_row["rarityScore"]

    def test_rarity_uses_90d_baseline_not_chart_window(self) -> None:
        cache.delete(f"ta:rarity-counts:v1:{self.organization.id}")
        # One custom in the 14d chart window; five more custom outside 14d but inside 90d.
        in_chart = self._annotation(
            annotation_type=AnnotationType.CUSTOM,
            start_timestamp=before_now(days=1),
        )
        for days_ago in (20, 30, 40, 50, 60):
            self._annotation(
                annotation_type=AnnotationType.CUSTOM,
                start_timestamp=before_now(days=days_ago),
            )

        with self.options({"system.event-retention-days": 90}):
            response = self.get_success_response(self.organization.slug, statsPeriod="14d")

        assert [row["id"] for row in response.data] == [str(in_chart.id)]
        # Chart has one row, but rarity denominator counted all six in 90d.
        assert response.data[0]["rarityScore"] == 1.0 / (1.0 + log1p(6))
        assert response.data[0]["rarityWindowDays"] == 90

    def test_rarity_window_clamped_to_retention(self) -> None:
        cache.delete(f"ta:rarity-counts:v1:{self.organization.id}")
        self._annotation()
        with self.options({"system.event-retention-days": 30}):
            response = self.get_success_response(self.organization.slug, statsPeriod="14d")
        assert response.data[0]["rarityWindowDays"] == 30


@with_feature("organizations:timeseries-annotations")
class CreateOrganizationTimeseriesAnnotationEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-timeseries-annotations"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def _payload(self, **kwargs: object) -> dict[str, object]:
        payload: dict[str, object] = dict(
            annotationType="custom",
            description="Deployed hotfix",
            startTimestamp=before_now(days=1).isoformat(),
        )
        payload.update(kwargs)
        return payload

    def test_creates_point_annotation(self) -> None:
        response = self.get_success_response(
            self.organization.slug, **self._payload(), status_code=201
        )
        annotation = TimeseriesAnnotation.objects.get(id=response.data["id"])
        assert annotation.organization_id == self.organization.id
        assert annotation.annotation_type == AnnotationType.CUSTOM
        assert annotation.interval_type == IntervalType.POINT
        assert annotation.scope == AnnotationScope.GLOBAL
        assert annotation.severity == Severity.LOW
        assert annotation.pinned is False
        assert annotation.created_by_id == self.user.id
        assert response.data["createdBy"] == {"type": "user", "id": str(self.user.id)}
        assert response.data["pinned"] is False

    def test_creates_pinned_annotation(self) -> None:
        response = self.get_success_response(
            self.organization.slug, **self._payload(pinned=True), status_code=201
        )
        annotation = TimeseriesAnnotation.objects.get(id=response.data["id"])
        assert annotation.pinned is True
        assert response.data["pinned"] is True

    def test_creates_range_annotation(self) -> None:
        start = before_now(days=2)
        end = before_now(days=1)
        response = self.get_success_response(
            self.organization.slug,
            **self._payload(
                annotationType="sentry_outage",
                scope="spans",
                severity="high",
                startTimestamp=start.isoformat(),
                endTimestamp=end.isoformat(),
                tags={"region": "us"},
            ),
            status_code=201,
        )
        annotation = TimeseriesAnnotation.objects.get(id=response.data["id"])
        assert annotation.interval_type == IntervalType.RANGE
        assert annotation.end_timestamp is not None
        assert annotation.scope == AnnotationScope.SPANS
        assert annotation.severity == Severity.HIGH
        assert annotation.tags == {"region": "us"}

    def test_scopes_annotation_to_project(self) -> None:
        project = self.create_project(organization=self.organization)
        response = self.get_success_response(
            self.organization.slug, **self._payload(projectId=project.id), status_code=201
        )
        assert TimeseriesAnnotation.objects.get(id=response.data["id"]).project_id == project.id

    def test_inaccessible_project_is_403(self) -> None:
        other_org = self.create_organization()
        foreign_project = self.create_project(organization=other_org)
        self.get_error_response(
            self.organization.slug, **self._payload(projectId=foreign_project.id), status_code=403
        )
        assert not TimeseriesAnnotation.objects.exists()

    def test_invalid_type_is_400(self) -> None:
        self.get_error_response(
            self.organization.slug, **self._payload(annotationType="bogus"), status_code=400
        )

    def test_end_before_start_is_400(self) -> None:
        self.get_error_response(
            self.organization.slug,
            **self._payload(
                startTimestamp=before_now(days=1).isoformat(),
                endTimestamp=before_now(days=2).isoformat(),
            ),
            status_code=400,
        )


@with_feature("organizations:timeseries-annotations")
class UpdateOrganizationTimeseriesAnnotationEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-timeseries-annotations"
    method = "put"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def _range(self, **kwargs: object) -> TimeseriesAnnotation:
        values = dict(
            organization_id=self.organization.id,
            interval_type=IntervalType.RANGE,
            annotation_type=AnnotationType.SENTRY_OUTAGE,
            description="outage",
            start_timestamp=before_now(days=2),
            end_timestamp=None,
            severity=Severity.LOW,
            tags={"region": "us"},
            created_by_label="statuspage",
        )
        values.update(kwargs)
        return TimeseriesAnnotation.objects.create(**values)

    def test_updates_the_matching_range(self) -> None:
        annotation = self._range()
        other = self._range(tags={"region": "eu"})
        end = before_now(days=1)
        response = self.get_success_response(
            self.organization.slug,
            filters={"id": annotation.id, "tags": {"region": "us"}},
            description="resolved",
            severity="high",
            endTimestamp=end.isoformat(),
        )
        annotation.refresh_from_db()
        other.refresh_from_db()
        assert annotation.description == "resolved"
        assert annotation.severity == Severity.HIGH
        assert annotation.end_timestamp is not None
        assert annotation.interval_type == IntervalType.RANGE
        assert annotation.updated_by_id == self.user.id
        assert annotation.updated_by_label is None
        assert annotation.created_by_label == "statuspage"
        assert other.description == "outage"
        assert response.data["id"] == str(annotation.id)
        assert response.data["severity"] == "high"
        assert response.data["endTimestamp"] is not None

    def test_tags_filter_selects_one_range(self) -> None:
        annotation = self._range(tags={"region": "us", "source": "statuspage"})
        self.get_success_response(
            self.organization.slug,
            filters={"tags": {"region": "us"}},
            description="us resolved",
        )
        annotation.refresh_from_db()
        assert annotation.description == "us resolved"
        assert annotation.end_timestamp is None
        assert annotation.severity == Severity.LOW

    def test_null_end_reopens_range(self) -> None:
        annotation = self._range(end_timestamp=before_now(days=1))
        self.get_success_response(
            self.organization.slug,
            filters={"id": annotation.id},
            endTimestamp=None,
        )
        annotation.refresh_from_db()
        assert annotation.end_timestamp is None
        assert annotation.description == "outage"

    def test_no_match_is_404(self) -> None:
        annotation = self._range()
        self.get_error_response(
            self.organization.slug,
            filters={"id": annotation.id, "tags": {"region": "eu"}},
            description="nope",
            status_code=404,
        )
        annotation.refresh_from_db()
        assert annotation.description == "outage"

    def test_two_matches_is_409(self) -> None:
        self._range(tags={"region": "us"})
        self._range(tags={"region": "us", "source": "statuspage"})
        self.get_error_response(
            self.organization.slug,
            filters={"tags": {"region": "us"}},
            description="nope",
            status_code=409,
        )
        assert not TimeseriesAnnotation.objects.filter(description="nope").exists()

    def test_point_is_not_updated(self) -> None:
        point = self._range(interval_type=IntervalType.POINT, tags={"region": "us"})
        self.get_error_response(
            self.organization.slug,
            filters={"id": point.id},
            description="nope",
            status_code=404,
        )
        point.refresh_from_db()
        assert point.description == "outage"

    def test_other_organization_is_404(self) -> None:
        other = self.create_organization()
        annotation = self._range(organization_id=other.id)
        self.get_error_response(
            self.organization.slug,
            filters={"id": annotation.id},
            description="nope",
            status_code=404,
        )
        annotation.refresh_from_db()
        assert annotation.description == "outage"

    def test_inaccessible_project_is_404(self) -> None:
        other_user = self.create_user()
        private_project = self.create_project(organization=self.organization, teams=[])
        self.create_team_membership(
            self.create_team(organization=self.organization), user=other_user
        )
        hidden = self._range(project_id=private_project.id)
        self.get_error_response(
            self.organization.slug,
            filters={"id": hidden.id},
            description="nope",
            status_code=404,
        )
        hidden.refresh_from_db()
        assert hidden.description == "outage"

    def test_end_before_start_is_400(self) -> None:
        annotation = self._range(start_timestamp=before_now(days=1))
        response = self.get_error_response(
            self.organization.slug,
            filters={"id": annotation.id},
            endTimestamp=before_now(days=2).isoformat(),
            status_code=400,
        )
        assert response.data["detail"] == "endTimestamp must be at or after startTimestamp"
        annotation.refresh_from_db()
        assert annotation.end_timestamp is None

    def test_empty_filters_is_400(self) -> None:
        self.get_error_response(
            self.organization.slug, filters={}, description="nope", status_code=400
        )

    def test_no_changes_is_400(self) -> None:
        annotation = self._range()
        self.get_error_response(
            self.organization.slug, filters={"id": annotation.id}, status_code=400
        )
