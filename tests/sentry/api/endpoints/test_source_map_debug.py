from django.core.files.base import ContentFile
from rest_framework import status

from sentry.api.helpers.source_map_helper import _find_url_prefix
from sentry.models.distribution import Distribution
from sentry.models.files.file import File
from sentry.models.release import Release
from sentry.models.releasefile import ReleaseFile
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_kafka, requires_snuba

pytestmark = [requires_snuba, requires_kafka]


@region_silo_test
class SourceMapDebugEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-event-source-map-debug"

    base_data = {
        "event_id": "a" * 32,
        "exception": {
            "values": [
                {
                    "type": "Error",
                    "stacktrace": {
                        "frames": [
                            {
                                "abs_path": "https://app.example.com/static/js/main.fa8fe19f.js",
                                "filename": "/static/js/main.fa8fe19f.js",
                                "lineno": 1,
                                "colno": 39,
                                "context_line": "function foo() {",
                            }
                        ]
                    },
                },
            ]
        },
    }

    def setUp(self) -> None:
        self.login_as(self.user)
        return super().setUp()

    def test_url_prefix(self):
        cases = [
            ("~/v1/scripts/footer/bundle.js", "~/v1/assets/footer/bundle.js", "assets/"),
            ("~/v1/scripts/footer/bundle.js", "~/v1/next/scripts/footer/bundle.js", "next/"),
            ("/static/js/application.js", "~/dist/static/js/application.js", "~/dist"),
            ("~/v1/scripts/footer/bundle.js", "~/v1/next/dist/scripts/footer/bundle.js", None),
        ]

        for filename, artifact_name, expected in cases:
            assert _find_url_prefix(filename, artifact_name) == expected

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

    def test_non_integer_frame_given(self):
        event = self.store_event(
            data={"event_id": "a" * 32, "release": "my-release"}, project_id=self.project.id
        )
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame_idx="hello",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert resp.data["detail"] == "Query parameter 'frame_idx' must be an integer"

    def test_non_integer_exception_given(self):
        event = self.store_event(
            data={"event_id": "a" * 32, "release": "my-release"}, project_id=self.project.id
        )
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame_idx=0,
            exception_idx="hello",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert resp.data["detail"] == "Query parameter 'exception_idx' must be an integer"

    def test_frame_out_of_bounds(self):
        event = self.store_event(
            data=self.base_data,
            project_id=self.project.id,
        )

        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame_idx=1,
            exception_idx=0,
        )
        assert resp.data["detail"] == "Query parameter 'frame_idx' is out of bounds"

    def test_no_exception(self):
        event_data = self.base_data.copy()
        del event_data["exception"]
        event = self.store_event(data=event_data, project_id=self.project.id)

        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame_idx=0,
            exception_idx=0,
        )

        assert resp.data["detail"] == "Event does not contain an exception"

    def test_exception_out_of_bounds(self):
        event = self.store_event(
            data=self.base_data,
            project_id=self.project.id,
        )

        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame_idx=0,
            exception_idx=1,
        )
        assert resp.data["detail"] == "Query parameter 'exception_idx' is out of bounds"

    def test_event_frame_has_source_maps(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "exception": {
                    "values": [
                        {
                            "type": "Error",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "abs_path": "https://app.example.com/static/js/main.fa8fe19f.js",
                                        "filename": "/static/js/main.fa8fe19f.js",
                                        "lineno": 1,
                                        "colno": 39,
                                        "context_line": "function foo() {",
                                        "data": {
                                            "sourcemap": "https://media.sentry.io/_static/29e365f8b0d923bc123e8afa38d890c3/sentry/dist/vendor.js.map"
                                        },
                                    }
                                ]
                            },
                        },
                    ]
                },
            },
            project_id=self.project.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame_idx=0,
            exception_idx=0,
        )
        error = resp.data["errors"]
        assert error == []

    def test_event_has_no_release(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "exception": {
                    "values": [
                        {
                            "type": "Error",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "abs_path": "https://app.example.com/static/js/main.fa8fe19f.js",
                                        "filename": "/static/js/main.fa8fe19f.js",
                                        "lineno": 1,
                                        "colno": 39,
                                    }
                                ]
                            },
                        },
                    ]
                },
            },
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

    def test_release_has_no_artifacts(self):
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
                                        "abs_path": "https://app.example.com/static/js/main.fa8fe19f.js",
                                        "filename": "/static/js/main.fa8fe19f.js",
                                        "lineno": 1,
                                        "colno": 39,
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
                                        "abs_path": "https://app.example.com/static/js/main.fa8fe19f.js",
                                        "filename": "/static/js/main.fa8fe19f.js",
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
                                        "abs_path": "app.example.com/static/js/main.fa8fe19f.js",
                                        "filename": "/static/js/main.fa8fe19f.js",
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
        assert error["data"] == {"absPath": "app.example.com/static/js/main.fa8fe19f.js"}

    def test_skips_node_internals(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "platform": "node",
                "exception": {
                    "values": [
                        {
                            "type": "TypeError",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "abs_path": "node:vm",
                                        "filename": "/static/js/main.fa8fe19f.js",
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

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame_idx=0,
            exception_idx=0,
        )
        assert len(resp.data["errors"]) == 0

    def test_skip_node_context_line(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "platform": "node",
                "exception": {
                    "values": [
                        {
                            "type": "TypeError",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "abs_path": "/app",
                                        "filename": "/static/js/main.fa8fe19f.js",
                                        "lineno": 5,
                                        "colno": 45,
                                        "context_line": "throw new Error('foo')",
                                    }
                                ]
                            },
                        },
                    ]
                },
            },
            project_id=self.project.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame_idx=0,
            exception_idx=0,
        )
        assert len(resp.data["errors"]) == 0

    def test_no_valid_url_skips_node(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "release": "my-release",
                "platform": "node",
                "exception": {
                    "values": [
                        {
                            "type": "TypeError",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "abs_path": "/path/to/file/thats/not/url/main.fa8fe19f.js",
                                        "filename": "/static/js/main.fa8fe19f.js",
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

        file = File.objects.create(
            name="application.js",
            type="release.file",
            headers={"Sourcemap": "/path/to/file/thats/not/url/main.fa8fe19f.js.map"},
        )
        fileobj = ContentFile(b"wat")
        file.putfile(fileobj)

        ReleaseFile.objects.create(
            organization_id=self.project.organization_id,
            release_id=release.id,
            file=file,
            name="/path/to/file/thats/not/url/main.fa8fe19f.js",
        )

        sourcemapfile = File.objects.create(
            name="/path/to/file/thats/not/url/main.fa8fe19f.js.map", type="release.file"
        )
        sourcemapfileobj = ContentFile(b"wat")
        sourcemapfile.putfile(sourcemapfileobj)

        ReleaseFile.objects.create(
            organization_id=self.project.organization_id,
            release_id=release.id,
            file=sourcemapfile,
            name="/path/to/file/thats/not/url/main.fa8fe19f.js.map",
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame_idx=0,
            exception_idx=0,
        )
        assert len(resp.data["errors"]) == 0

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
                                        "abs_path": "https://app.example.com/static/js/application.js",
                                        "filename": "/static/js/application.js",
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
            file=File.objects.create(name="incorrect_application.js", type="release.file"),
            name="~/dist/static/js/incorrect_application.js",
        )

        ReleaseFile.objects.create(
            organization_id=self.project.organization_id,
            release_id=release.id,
            file=File.objects.create(name="application.js", type="release.file"),
            name="~/dist/static/js/application.js",
        )

        ReleaseFile.objects.create(
            organization_id=self.project.organization_id,
            release_id=release.id,
            file=File.objects.create(name="also_incorrect_application.js", type="release.file"),
            name="~/dist/static/js/also_incorrect_application.js",
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
            "absPath": "https://app.example.com/static/js/application.js",
            "partialMatchPath": "~/dist/static/js/application.js",
            "filename": "/static/js/application.js",
            "unifiedPath": "~/static/js/application.js",
            "urlPrefix": "~/dist",
            "artifactNames": [
                "~/dist/static/js/also_incorrect_application.js",
                "~/dist/static/js/application.js",
                "~/dist/static/js/incorrect_application.js",
            ],
        }

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
                                        "abs_path": "https://app.example.com/static/js/main.fa8fe19f.js",
                                        "filename": "/static/js/main.fa8fe19f.js",
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
            "absPath": "https://app.example.com/static/js/main.fa8fe19f.js",
            "filename": "/static/js/main.fa8fe19f.js",
            "unifiedPath": "~/static/js/main.fa8fe19f.js",
            "artifactNames": ["http://example.com/application.js"],
        }

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
                                        "filename": "/application.js",
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
        assert error["data"] == {
            "eventDist": event_dist.id,
            "artifactDist": dist.id,
            "filename": "/application.js",
        }

    def test_no_sourcemap_found(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "release": "my-release",
                "dist": None,
                "exception": {
                    "values": [
                        {
                            "type": "Error",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "abs_path": "https://example.com/application.js",
                                        "filename": "/application.js",
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

        file = File.objects.create(name="application.js", type="release.file")
        fileobj = ContentFile(b"a\na")
        file.putfile(fileobj)

        ReleaseFile.objects.create(
            organization_id=self.project.organization_id,
            release_id=release.id,
            file=file,
            name="~/application.js",
            dist_id=None,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame_idx=0,
            exception_idx=0,
        )

        error = resp.data["errors"][0]
        assert error["type"] == "sourcemap_not_found"
        assert error["message"] == "The sourcemap could not be found"
        assert error["data"] == {
            "filename": "/application.js",
        }

    def test_sourcemap_in_header(self):
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

        file = File.objects.create(
            name="application.js", type="release.file", headers={"Sourcemap": "application.js.map"}
        )
        fileobj = ContentFile(b"a\na")
        file.putfile(fileobj)

        ReleaseFile.objects.create(
            organization_id=self.project.organization_id,
            release_id=release.id,
            file=file,
            name="~/application.js",
            dist_id=dist.id,
        )

        ReleaseFile.objects.create(
            organization_id=self.project.organization_id,
            release_id=release.id,
            file=file,
            name="~/application.js.map",
            dist_id=dist.id,
        )

        sourcemapfile = File.objects.create(name="application.js.map", type="release.file")
        sourcemapfileobj = ContentFile(b"mapping code")
        sourcemapfile.putfile(sourcemapfileobj)

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame_idx=0,
            exception_idx=0,
        )

        assert resp.data["errors"] == []

    def test_sourcemap_in_file(self):
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

        file = File.objects.create(name="application.js", type="release.file")
        fileobj = ContentFile(b"a\n//# sourceMappingURL=application.js.map")
        file.putfile(fileobj)

        ReleaseFile.objects.create(
            organization_id=self.project.organization_id,
            release_id=release.id,
            file=file,
            name="~/application.js",
            dist_id=dist.id,
        )

        ReleaseFile.objects.create(
            organization_id=self.project.organization_id,
            release_id=release.id,
            file=file,
            name="~/application.js.map",
            dist_id=dist.id,
        )

        sourcemapfile = File.objects.create(name="application.js.map", type="release.file")
        sourcemapfileobj = ContentFile(b"mapping code")
        sourcemapfile.putfile(sourcemapfileobj)

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame_idx=0,
            exception_idx=0,
        )

        assert resp.data["errors"] == []

    def test_js_out_of_date(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "release": "my-release",
                "dist": "my-dist",
                "sdk": {
                    "name": "sentry.javascript.browser",
                    "version": "7.8.0",
                },
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

    def test_remix_up_to_date(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "release": "my-release",
                "dist": "my-dist",
                "sdk": {
                    "name": "sentry.javascript.remix",
                    "version": "7.46.0",
                },
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

    def test_valid_debugid_sdk_no_sourcemaps(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "release": "my-release",
                "dist": "my-dist",
                "sdk": {
                    "name": "sentry.javascript.browser",
                    "version": "7.46.0",
                },
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
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame_idx=0,
            exception_idx=0,
        )

        error = resp.data["errors"][0]
        assert error["type"] == "debug_id_no_sourcemaps"
        assert error["message"] == "Can use debug id but no sourcemaps"
