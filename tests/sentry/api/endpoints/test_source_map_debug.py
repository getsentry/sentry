from rest_framework import status

from sentry.models import Distribution, File, Release, ReleaseFile
from sentry.testutils import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import region_silo_test


@region_silo_test  # TODO(hybrid-cloud): stable=True blocked on actors
class ProjectOwnershipEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-event-source-map-debug"

    def setUp(self) -> None:
        self.login_as(self.user)
        return super().setUp()

    def test_no_feature_flag(self):
        event = self.store_event(
            data={"event_id": "a" * 32},
            project_id=self.project.id,
        )
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame=0,
            status_code=status.HTTP_404_NOT_FOUND,
        )
        assert (
            resp.data["detail"]
            == "Endpoint not available without 'organizations:fix-source-map-cta' feature flag"
        )

    @with_feature("organizations:fix-source-map-cta")
    def test_missing_event(self):
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            "invalid_id",
            frame_idx=0,
            exception_idx=0,
            status_code=status.HTTP_404_NOT_FOUND,
        )
        assert resp.data["detail"] == "Event not found"

    @with_feature("organizations:fix-source-map-cta")
    def test_no_frame_given(self):
        event = self.store_event(
            data={"event_id": "a" * 32, "release": "my-release"}, project_id=self.project.id
        )
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert resp.data["detail"] == "Query parameter 'frame_idx' is required"

    @with_feature("organizations:fix-source-map-cta")
    def test_no_errors(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "release": "my-release",
                "dist": "my-dist",
                "exception": {
                    "values": [
                        {
                            "type": "Error",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "abs_path": "https://example.com/application.js",
                                        "lineno": 1,
                                        "colno": 39,
                                    }
                                ]
                            },
                        }
                    ]
                },
            },
            project_id=self.project.id,
        )
        release = Release.objects.get(organization=self.organization, version=event.release)
        release.update(user_agent="test_user_agent")

        dist = Distribution.objects.get(
            organization_id=self.organization.id, name="my-dist", release_id=release.id
        )

        ReleaseFile.objects.create(
            organization_id=self.project.organization_id,
            release_id=release.id,
            file=File.objects.create(name="application.js", type="release.file"),
            name="~/application.js",
            # change dist to something else
            dist_id=dist.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame_idx=0,
            exception_idx=0,
        )

        assert resp.data["errors"] == []

    @with_feature("organizations:fix-source-map-cta")
    def test_event_has_no_release(self):
        event = self.store_event(
            data={"event_id": "a" * 32},
            project_id=self.project.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame_idx=0,
            exception_idx=0,
        )
        error = resp.data["errors"][0]
        assert error["type"] == "no_release_on_event"
        assert error["message"] == "The event is missing a release"

    @with_feature("organizations:fix-source-map-cta")
    def test_release_has_no_user_agent(self):
        event = self.store_event(
            data={"event_id": "a" * 32, "release": "my-release"}, project_id=self.project.id
        )
        Release.objects.get(organization=self.organization, version=event.release)

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame_idx=0,
            exception_idx=0,
        )

        error = resp.data["errors"][0]
        assert error["type"] == "no_user_agent_on_release"
        assert error["message"] == "The release is missing a user agent"
        assert error["data"] == {"version": "my-release"}

    @with_feature("organizations:fix-source-map-cta")
    def test_release_has_no_artifacts(self):
        event = self.store_event(
            data={"event_id": "a" * 32, "release": "my-release"}, project_id=self.project.id
        )
        release = Release.objects.get(organization=self.organization, version=event.release)
        release.update(user_agent="test_user_agent")
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame_idx=0,
            exception_idx=0,
        )

        error = resp.data["errors"][0]
        assert error["type"] == "no_sourcemaps_on_release"
        assert error["message"] == "The release is missing source maps"

    @with_feature("organizations:fix-source-map-cta")
    def test_no_valid_url(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "release": "my-release",
                "exception": {
                    "values": [
                        {
                            "type": "Error",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "abs_path": "https://app.example.com/static/static/js/main.fa8fe19f.js",
                                        "lineno": 1,
                                        "colno": 39,
                                    }
                                ]
                            },
                        },
                        {
                            "type": "TypeError",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "abs_path": "app.example.com/static/static/js/main.fa8fe19f.js",
                                        "lineno": 5,
                                        "colno": 45,
                                    }
                                ]
                            },
                        },
                    ]
                },
            },
            project_id=self.project.id,
        )
        release = Release.objects.get(organization=self.organization, version=event.release)
        release.update(user_agent="test_user_agent")

        ReleaseFile.objects.create(
            organization_id=self.project.organization_id,
            release_id=release.id,
            file=File.objects.create(name="application.js", type="release.file"),
            name="http://example.com/application.js",
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame_idx=0,
            exception_idx=1,
        )
        error = resp.data["errors"][0]
        assert error["type"] == "url_not_valid"
        assert error["message"] == "The absolute path url is not valid"
        assert error["data"] == {"absValue": "app.example.com/static/static/js/main.fa8fe19f.js"}

    @with_feature("organizations:fix-source-map-cta")
    def test_partial_url_match(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "release": "my-release",
                "exception": {
                    "values": [
                        {
                            "type": "Error",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "abs_path": "https://app.example.com/static/static/js/application.js",
                                        "lineno": 1,
                                        "colno": 39,
                                    }
                                ]
                            },
                        }
                    ]
                },
            },
            project_id=self.project.id,
        )
        release = Release.objects.get(organization=self.organization, version=event.release)
        release.update(user_agent="test_user_agent")

        ReleaseFile.objects.create(
            organization_id=self.project.organization_id,
            release_id=release.id,
            file=File.objects.create(name="application.js", type="release.file"),
            name="http://example.com/application.js",
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame_idx=0,
            exception_idx=0,
        )

        error = resp.data["errors"][0]
        assert error["type"] == "partial_match"
        assert error["message"] == "The absolute path url is a partial match"
        assert error["data"] == {
            "insertPath": "https://app.example.com/static/static/js/application.js",
            "matchedSourcemapPath": "http://example.com/application.js",
        }

    @with_feature("organizations:fix-source-map-cta")
    def test_no_url_match(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "release": "my-release",
                "exception": {
                    "values": [
                        {
                            "type": "Error",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "abs_path": "https://app.example.com/static/static/js/main.fa8fe19f.js",
                                        "lineno": 1,
                                        "colno": 39,
                                    }
                                ]
                            },
                        }
                    ]
                },
            },
            project_id=self.project.id,
        )
        release = Release.objects.get(organization=self.organization, version=event.release)
        release.update(user_agent="test_user_agent")

        ReleaseFile.objects.create(
            organization_id=self.project.organization_id,
            release_id=release.id,
            file=File.objects.create(name="application.js", type="release.file"),
            name="http://example.com/application.js",
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame_idx=0,
            exception_idx=0,
        )
        error = resp.data["errors"][0]
        assert error["type"] == "no_url_match"
        assert error["message"] == "The absolute path url does not match any source maps"
        assert error["data"] == {
            "absPath": "https://app.example.com/static/static/js/main.fa8fe19f.js"
        }

    @with_feature("organizations:fix-source-map-cta")
    def test_dist_mismatch(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "release": "my-release",
                "dist": "my-dist",
                "exception": {
                    "values": [
                        {
                            "type": "Error",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "abs_path": "https://example.com/application.js",
                                        "lineno": 1,
                                        "colno": 39,
                                    }
                                ]
                            },
                        }
                    ]
                },
            },
            project_id=self.project.id,
        )
        release = Release.objects.get(organization=self.organization, version=event.release)
        release.update(user_agent="test_user_agent")

        event_dist = Distribution.objects.get(name="my-dist", release=release)

        dist = Distribution.objects.create(
            organization_id=self.organization.id, name="diff-dist", release_id=release.id
        )

        ReleaseFile.objects.create(
            organization_id=self.project.organization_id,
            release_id=release.id,
            file=File.objects.create(name="application.js", type="release.file"),
            name="~/application.js",
            # change dist to something else
            dist_id=dist.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame_idx=0,
            exception_idx=0,
        )
        error = resp.data["errors"][0]
        assert error["type"] == "dist_mismatch"
        assert error["message"] == "The dist values do not match"
        assert error["data"] == {"eventDist": event_dist.id, "artifactDist": dist.id}
