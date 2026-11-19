from sentry.testutils.cases import APITestCase
from sentry.timeseries_annotations.models import (
    AnnotationScope,
    AnnotationType,
    TimeseriesAnnotation,
)


class ProjectFilterDetailsTest(APITestCase):
    endpoint = "sentry-api-0-project-filters-details"
    method = "put"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def test_put(self) -> None:
        org = self.create_organization(name="baz", slug="1", owner=self.user)
        team = self.create_team(organization=org, name="foo", slug="foo")
        project = self.create_project(name="Bar", slug="bar", teams=[team])

        project.update_option("filters:browser-extensions", "0")
        self.get_success_response(
            org.slug, project.slug, "browser-extensions", active=True, status_code=204
        )

        assert project.get_option("filters:browser-extensions") == "1"

    def test_put_health_check_filter(self) -> None:
        """
        Tests that it accepts to set the health-check filter when the feature flag is enabled
        """
        org = self.create_organization(name="baz", slug="1", owner=self.user)
        team = self.create_team(organization=org, name="foo", slug="foo")
        project = self.create_project(name="Bar", slug="bar", teams=[team])

        project.update_option("filters:filtered-transaction", "0")
        self.get_success_response(
            org.slug, project.slug, "filtered-transaction", active=True, status_code=204
        )
        # option was changed by the request
        assert project.get_option("filters:filtered-transaction") == "1"

        project.update_option("filters:filtered-transaction", "1")
        self.get_success_response(
            org.slug, project.slug, "filtered-transaction", active=False, status_code=204
        )
        # option was changed by the request
        assert project.get_option("filters:filtered-transaction") == "0"

    def test_put_legacy_browsers(self) -> None:
        org = self.create_organization(name="baz", slug="1", owner=self.user)
        team = self.create_team(organization=org, name="foo", slug="foo")
        project = self.create_project(name="Bar", slug="bar", teams=[team])

        project.update_option(
            "filters:legacy-browsers",
            [
                "ie10",
                "ie9",
                "android_pre_4",
                "ie_pre_9",
                "opera_pre_15",
                "safari_pre_6",
                "ie11",
                "opera_mini_pre_8",
            ],
        )

        new_subfilters = [
            "edge_pre_79",
            "ie10",
            "ie11",
            "opera_mini_pre_8",
            "opera_pre_15",
            "safari_pre_6",
        ]

        self.get_success_response(
            org.slug,
            project.slug,
            "legacy-browsers",
            subfilters=new_subfilters,
            status_code=204,
        )

        assert project.get_option("filters:legacy-browsers") == new_subfilters


class ProjectFilterDetailsAnnotationTest(APITestCase):
    endpoint = "sentry-api-0-project-filters-details"
    method = "put"
    features = [
        "organizations:timeseries-annotations",
        "organizations:timeseries-annotations-usecase-filter-change",
    ]

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.project.update_option("filters:browser-extensions", "0")

    def test_records_annotation_on_change(self) -> None:
        with self.feature(self.features):
            self.get_success_response(
                self.organization.slug,
                self.project.slug,
                "browser-extensions",
                active=True,
                status_code=204,
            )

        annotation = TimeseriesAnnotation.objects.get(project_id=self.project.id)
        assert annotation.annotation_type == AnnotationType.INBOUND_FILTER_CHANGE
        assert annotation.scope == AnnotationScope.ERRORS
        assert annotation.tags == {"filter": "browser-extensions"}
        assert annotation.created_by_id == self.user.id

    def test_health_check_filter_is_spans_scoped(self) -> None:
        self.project.update_option("filters:filtered-transaction", "0")
        with self.feature(self.features):
            self.get_success_response(
                self.organization.slug,
                self.project.slug,
                "filtered-transaction",
                active=True,
                status_code=204,
            )

        annotation = TimeseriesAnnotation.objects.get(project_id=self.project.id)
        assert annotation.scope == AnnotationScope.SPANS

    def test_no_annotation_when_state_unchanged(self) -> None:
        with self.feature(self.features):
            self.get_success_response(
                self.organization.slug,
                self.project.slug,
                "browser-extensions",
                active=False,
                status_code=204,
            )

        assert not TimeseriesAnnotation.objects.filter(project_id=self.project.id).exists()

    def test_no_annotation_without_framework_feature(self) -> None:
        with self.feature("organizations:timeseries-annotations-usecase-filter-change"):
            self.get_success_response(
                self.organization.slug,
                self.project.slug,
                "browser-extensions",
                active=True,
                status_code=204,
            )

        assert not TimeseriesAnnotation.objects.filter(project_id=self.project.id).exists()

    def test_no_annotation_without_usecase_feature(self) -> None:
        with self.feature("organizations:timeseries-annotations"):
            self.get_success_response(
                self.organization.slug,
                self.project.slug,
                "browser-extensions",
                active=True,
                status_code=204,
            )

        assert not TimeseriesAnnotation.objects.filter(project_id=self.project.id).exists()
