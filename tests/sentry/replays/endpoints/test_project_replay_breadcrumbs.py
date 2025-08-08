import uuid
from datetime import datetime, timedelta

from django.urls import reverse

from sentry.replays.lib.eap.write import new_trace_item, write_trace_items_test_suite
from sentry.testutils.cases import APITestCase, SnubaTestCase

REPLAYS_FEATURES = {"organizations:session-replay": True}


class ProjectReplayBreadcrumbsEndpointTest(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-project-replay-details-breadcrumbs"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.replay_id = uuid.uuid4().hex
        self.url = reverse(
            self.endpoint, args=(self.organization.slug, self.project.slug, self.replay_id)
        )

    def test_get_ui_click_breadcrumb(self):
        self._test_breadcrumb_type(
            {
                "category": "ui.click",
                "replay_id": self.replay_id,
                "node_id": 1,
                "tag": "tag",
                "text": "text",
                "is_dead": False,
                "is_rage": True,
                "selector": "selector",
                "alt": "alt",
                "aria_label": "aria_label",
                "component_name": "component_name",
                "class": "class",
                "id": "id",
                "role": "role",
                "title": "title",
                "testid": "testid",
            }
        )

    def test_get_navigation_breadcrumb(self):
        self._test_breadcrumb_type(
            {
                "category": "navigation",
                "replay_id": self.replay_id,
                "from": "from",
                "to": "to",
            }
        )

    def test_get_resource_xhr_breadcrumb(self):
        self._test_breadcrumb_type(
            {
                "category": "resource.xhr",
                "replay_id": self.replay_id,
                "url": "url",
                "method": "method",
                "duration": 4.0,
                "statusCode": 1,
                "request_size": 2,
                "response_size": 3,
            }
        )

    def test_get_resource_fetch_breadcrumb(self):
        self._test_breadcrumb_type(
            {
                "category": "resource.fetch",
                "replay_id": self.replay_id,
                "url": "url",
                "method": "method",
                "duration": 4.0,
                "statusCode": 1,
                "request_size": 2,
                "response_size": 3,
            }
        )

    def test_get_resource_script_breadcrumb(self):
        self._test_breadcrumb_type(
            {
                "category": "resource.script",
                "replay_id": self.replay_id,
                "url": "url",
                "duration": 1.0,
                "size": 2.0,
                "statusCode": 1,
                "decodedBodySize": 2,
                "encodedBodySize": 3,
            }
        )

    def test_get_resource_img_breadcrumb(self):
        self._test_breadcrumb_type(
            {
                "category": "resource.img",
                "replay_id": self.replay_id,
                "url": "url",
                "duration": 1.0,
                "size": 2.0,
                "statusCode": 1,
                "decodedBodySize": 2,
                "encodedBodySize": 3,
            }
        )

    def test_get_web_vital_cls_breadcrumb(self):
        self._test_breadcrumb_type(
            {
                "category": "web-vital.cls",
                "replay_id": self.replay_id,
                "duration": 1.0,
                "rating": "rating",
                "size": 2.0,
                "value": 3.0,
            }
        )

    def test_get_web_vital_fcp_breadcrumb(self):
        self._test_breadcrumb_type(
            {
                "category": "web-vital.fcp",
                "replay_id": self.replay_id,
                "duration": 1.0,
                "rating": "rating",
                "size": 2.0,
                "value": 3.0,
            }
        )

    def test_get_web_vital_lcp_breadcrumb(self):
        self._test_breadcrumb_type(
            {
                "category": "web-vital.lcp",
                "replay_id": self.replay_id,
                "duration": 1.0,
                "rating": "rating",
                "size": 2.0,
                "value": 3.0,
            }
        )

    def test_get_replay_hydrate_error_breadcrumb(self):
        self._test_breadcrumb_type(
            {
                "category": "replay.hydrate-error",
                "replay_id": self.replay_id,
                "url": "url",
            }
        )

    def test_get_mutations_breadcrumb(self):
        self._test_breadcrumb_type(
            {
                "category": "replay.mutations",
                "replay_id": self.replay_id,
                "count": 22,
            }
        )

    def test_get_sdk_options_breadcrumb(self):
        self._test_breadcrumb_type(
            {
                "category": "sdk.options",
                "replay_id": self.replay_id,
                "shouldRecordCanvas": True,
                "useCompressionOption": True,
                "blockAllMedia": True,
                "maskAllText": True,
                "maskAllInputs": True,
                "useCompression": True,
                "networkDetailHasUrls": True,
                "networkCaptureBodies": True,
                "networkRequestHasHeaders": True,
                "networkResponseHasHeaders": True,
                "sessionSampleRate": 1.0,
                "errorSampleRate": 1.0,
            }
        )

    def test_get_memory_breadcrumb(self):
        self._test_breadcrumb_type(
            {
                "category": "memory",
                "replay_id": self.replay_id,
                "jsHeapSizeLimit": 1,
                "totalJSHeapSize": 2,
                "usedJSHeapSize": 3,
                "endTimestamp": 4.0,
                "duration": 5.0,
            }
        )

    def _test_breadcrumb_type(self, attributes):
        write_trace_items_test_suite(
            [
                new_trace_item(
                    {
                        "attributes": attributes,
                        "client_sample_rate": 1.0,
                        "organization_id": self.project.organization.id,
                        "project_id": self.project.id,
                        "received": datetime.now(),
                        "retention_days": 90,
                        "server_sample_rate": 1.0,
                        "timestamp": datetime.now() - timedelta(minutes=1),
                        "trace_id": uuid.uuid4().hex,
                        "trace_item_id": uuid.uuid4().bytes,
                        "trace_item_type": "replay",
                    }
                )
            ]
        )

        with self.feature(REPLAYS_FEATURES):
            response = self.client.get(self.url + "?statsPeriod=1d")
            assert response.status_code == 200

            response_json = response.json()
            assert len(response_json["data"]) == 1

            attributes.pop("replay_id")
            assert attributes.pop("category") == response_json["data"][0]["type"]

            for key, value in attributes.items():
                assert response_json["data"][0]["attributes"][key] == value
