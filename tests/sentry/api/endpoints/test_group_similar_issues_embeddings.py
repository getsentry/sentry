import copy
from collections.abc import Mapping, Sequence
from typing import Any
from unittest import mock

import orjson
from urllib3.response import HTTPResponse

from sentry.api.endpoints.group_similar_issues_embeddings import (
    GroupSimilarIssuesEmbeddingsEndpoint,
    get_stacktrace_string,
)
from sentry.api.serializers.base import serialize
from sentry.conf.server import SEER_SIMILAR_ISSUES_URL
from sentry.models.group import Group
from sentry.seer.utils import SeerSimilarIssueData, SimilarIssuesEmbeddingsResponse
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.helpers.features import with_feature
from sentry.utils.types import NonNone

EXPECTED_STACKTRACE_STRING = 'ZeroDivisionError: division by zero\n  File "python_onboarding.py", function divide_by_zero\n    divide = 1/0'
BASE_APP_DATA: dict[str, Any] = {
    "app": {
        "type": "component",
        "description": "in-app",
        "hash": "hash",
        "component": {
            "id": "app",
            "name": "in-app",
            "contributes": True,
            "hint": None,
            "values": [
                {
                    "id": "exception",
                    "name": "exception",
                    "contributes": True,
                    "hint": None,
                    "values": [
                        {
                            "id": "stacktrace",
                            "name": "stack-trace",
                            "contributes": True,
                            "hint": None,
                            "values": [
                                {
                                    "id": "frame",
                                    "name": None,
                                    "contributes": True,
                                    "hint": None,
                                    "values": [
                                        {
                                            "id": "module",
                                            "name": None,
                                            "contributes": True,
                                            "hint": None,
                                            "values": ["__main__"],
                                        },
                                        {
                                            "id": "filename",
                                            "name": None,
                                            "contributes": False,
                                            "hint": None,
                                            "values": ["python_onboarding.py"],
                                        },
                                        {
                                            "id": "function",
                                            "name": None,
                                            "contributes": True,
                                            "hint": None,
                                            "values": ["divide_by_zero"],
                                        },
                                        {
                                            "id": "context-line",
                                            "name": None,
                                            "contributes": True,
                                            "hint": None,
                                            "values": ["divide = 1/0"],
                                        },
                                    ],
                                }
                            ],
                        },
                        {
                            "id": "type",
                            "name": None,
                            "contributes": True,
                            "hint": None,
                            "values": ["ZeroDivisionError"],
                        },
                        {
                            "id": "value",
                            "name": None,
                            "contributes": False,
                            "hint": None,
                            "values": ["division by zero"],
                        },
                    ],
                }
            ],
        },
    }
}
CHAINED_APP_DATA: dict[str, Any] = {
    "app": {
        "type": "component",
        "description": "in-app",
        "hash": "hash",
        "component": {
            "id": "app",
            "name": "in-app",
            "contributes": True,
            "hint": None,
            "values": [
                {
                    "id": "chained-exception",
                    "name": None,
                    "contributes": True,
                    "hint": None,
                    "values": [
                        {
                            "id": "exception",
                            "name": "exception",
                            "contributes": True,
                            "hint": None,
                            "values": [
                                {
                                    "id": "stacktrace",
                                    "name": "stack-trace",
                                    "contributes": True,
                                    "hint": None,
                                    "values": [
                                        {
                                            "id": "frame",
                                            "name": None,
                                            "contributes": True,
                                            "hint": None,
                                            "values": [
                                                {
                                                    "id": "module",
                                                    "name": None,
                                                    "contributes": True,
                                                    "hint": None,
                                                    "values": ["__main__"],
                                                },
                                                {
                                                    "id": "filename",
                                                    "name": None,
                                                    "contributes": False,
                                                    "hint": None,
                                                    "values": ["python_onboarding.py"],
                                                },
                                                {
                                                    "id": "function",
                                                    "name": None,
                                                    "contributes": True,
                                                    "hint": None,
                                                    "values": ["divide_by_zero"],
                                                },
                                                {
                                                    "id": "context-line",
                                                    "name": None,
                                                    "contributes": True,
                                                    "hint": None,
                                                    "values": ["divide = 1/0"],
                                                },
                                            ],
                                        }
                                    ],
                                },
                                {
                                    "id": "type",
                                    "name": None,
                                    "contributes": True,
                                    "hint": None,
                                    "values": ["ZeroDivisionError"],
                                },
                                {
                                    "id": "value",
                                    "name": None,
                                    "contributes": False,
                                    "hint": None,
                                    "values": ["division by zero"],
                                },
                            ],
                        },
                        {
                            "id": "exception",
                            "name": "exception",
                            "contributes": True,
                            "hint": None,
                            "values": [
                                {
                                    "id": "stacktrace",
                                    "name": "stack-trace",
                                    "contributes": True,
                                    "hint": None,
                                    "values": [
                                        {
                                            "id": "frame",
                                            "name": None,
                                            "contributes": True,
                                            "hint": None,
                                            "values": [
                                                {
                                                    "id": "module",
                                                    "name": None,
                                                    "contributes": True,
                                                    "hint": None,
                                                    "values": ["__main__"],
                                                },
                                                {
                                                    "id": "filename",
                                                    "name": None,
                                                    "contributes": False,
                                                    "hint": None,
                                                    "values": ["python_onboarding.py"],
                                                },
                                                {
                                                    "id": "function",
                                                    "name": None,
                                                    "contributes": True,
                                                    "hint": None,
                                                    "values": ["<module>"],
                                                },
                                                {
                                                    "id": "context-line",
                                                    "name": None,
                                                    "contributes": True,
                                                    "hint": None,
                                                    "values": ["divide_by_zero()"],
                                                },
                                            ],
                                        },
                                        {
                                            "id": "frame",
                                            "name": None,
                                            "contributes": True,
                                            "hint": None,
                                            "values": [
                                                {
                                                    "id": "module",
                                                    "name": None,
                                                    "contributes": True,
                                                    "hint": None,
                                                    "values": ["__main__"],
                                                },
                                                {
                                                    "id": "filename",
                                                    "name": None,
                                                    "contributes": False,
                                                    "hint": None,
                                                    "values": ["python_onboarding.py"],
                                                },
                                                {
                                                    "id": "function",
                                                    "name": None,
                                                    "contributes": True,
                                                    "hint": None,
                                                    "values": ["divide_by_zero"],
                                                },
                                                {
                                                    "id": "context-line",
                                                    "name": None,
                                                    "contributes": True,
                                                    "hint": None,
                                                    "values": [
                                                        'raise Exception("Catch divide by zero error")'
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    "id": "type",
                                    "name": None,
                                    "contributes": True,
                                    "hint": None,
                                    "values": ["Exception"],
                                },
                                {
                                    "id": "value",
                                    "name": None,
                                    "contributes": False,
                                    "hint": None,
                                    "values": ["Catch divide by zero error"],
                                },
                            ],
                        },
                    ],
                }
            ],
        },
    }
}

MOBILE_THREAD_DATA = {
    "app": {
        "type": "component",
        "description": "in-app thread stack-trace",
        "hash": "hash",
        "component": {
            "id": "app",
            "name": "in-app",
            "contributes": True,
            "hint": None,
            "values": [
                {
                    "id": "threads",
                    "name": "thread",
                    "contributes": True,
                    "hint": None,
                    "values": [
                        {
                            "id": "stacktrace",
                            "name": "stack-trace",
                            "contributes": True,
                            "hint": None,
                            "values": [
                                {
                                    "id": "frame",
                                    "name": None,
                                    "contributes": True,
                                    "hint": "marked out of app by stack trace rule (function:dbx v-group -group v-app -app)",
                                    "values": [
                                        {
                                            "id": "module",
                                            "name": None,
                                            "contributes": True,
                                            "hint": None,
                                            "values": [],
                                        },
                                        {
                                            "id": "filename",
                                            "name": None,
                                            "contributes": True,
                                            "hint": None,
                                            "values": [],
                                        },
                                        {
                                            "id": "function",
                                            "name": None,
                                            "contributes": True,
                                            "hint": "ignored unknown function",
                                            "values": ["TestHandler"],
                                        },
                                    ],
                                }
                            ],
                        }
                    ],
                }
            ],
        },
    }
}


class GroupSimilarIssuesEmbeddingsTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.base_error_trace = {
            "fingerprint": ["my-route", "{{ default }}"],
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "divide_by_zero",
                                    "module": "__main__",
                                    "filename": "python_onboarding.py",
                                    "abs_path": "/Users/jodi/python_onboarding/python_onboarding.py",
                                    "lineno": 20,
                                    "context_line": " divide = 1/0",
                                    "in_app": True,
                                },
                            ]
                        },
                        "type": "ZeroDivisionError",
                        "value": "division by zero",
                    }
                ]
            },
            "platform": "python",
        }
        self.event = self.store_event(data=self.base_error_trace, project_id=self.project)
        self.group = self.event.group
        assert self.group
        self.path = f"/api/0/issues/{self.group.id}/similar-issues-embeddings/"
        self.similar_event = self.store_event(
            data={"message": "Dogs are great!"}, project_id=self.project
        )

    def create_exception(
        self, exception_type_str="Exception", exception_value="it broke", frames=None
    ):
        frames = frames or []
        return {
            "id": "exception",
            "name": "exception",
            "contributes": True,
            "hint": None,
            "values": [
                {
                    "id": "stacktrace",
                    "name": "stack-trace",
                    "contributes": True,
                    "hint": None,
                    "values": frames,
                },
                {
                    "id": "type",
                    "name": None,
                    "contributes": True,
                    "hint": None,
                    "values": [exception_type_str],
                },
                {
                    "id": "value",
                    "name": None,
                    "contributes": False,
                    "hint": None,
                    "values": [exception_value],
                },
            ],
        }

    def create_frames(
        self,
        num_frames,
        contributes=True,
        start_index=1,
        context_line_factory=lambda i: f"test = {i}!",
    ):
        frames = []
        for i in range(start_index, start_index + num_frames):
            frames.append(
                {
                    "id": "frame",
                    "name": None,
                    "contributes": contributes,
                    "hint": None,
                    "values": [
                        {
                            "id": "filename",
                            "name": None,
                            "contributes": contributes,
                            "hint": None,
                            "values": ["hello.py"],
                        },
                        {
                            "id": "function",
                            "name": None,
                            "contributes": contributes,
                            "hint": None,
                            "values": ["hello_there"],
                        },
                        {
                            "id": "context-line",
                            "name": None,
                            "contributes": contributes,
                            "hint": None,
                            "values": [context_line_factory(i)],
                        },
                    ],
                }
            )
        return frames

    def get_expected_response(
        self,
        group_ids: Sequence[int],
        message_distances: Sequence[float],
        exception_distances: Sequence[float],
        should_be_grouped: Sequence[str],
    ) -> Sequence[tuple[Any, Mapping[str, Any]]]:
        serialized_groups = serialize(
            list(Group.objects.get_many_from_cache(group_ids)), user=self.user
        )
        response = []
        for i, group in enumerate(serialized_groups):
            response.append(
                (
                    group,
                    {
                        "message": message_distances[i],
                        "exception": exception_distances[i],
                        "shouldBeGrouped": should_be_grouped[i],
                    },
                )
            )
        return response

    def test_get_stacktrace_string_simple(self):
        stacktrace_str = get_stacktrace_string(BASE_APP_DATA)
        expected_stacktrace_str = 'ZeroDivisionError: division by zero\n  File "python_onboarding.py", function divide_by_zero\n    divide = 1/0'
        assert stacktrace_str == expected_stacktrace_str

    def test_get_stacktrace_string_no_values(self):
        stacktrace_string = get_stacktrace_string({})
        assert stacktrace_string == ""

    def test_get_stacktrace_string_contributing_exception_no_frames(self):
        data_non_contributing_frame = copy.deepcopy(BASE_APP_DATA)
        data_non_contributing_frame["app"]["component"]["values"][0]["values"][0]["values"] = []
        stacktrace_str = get_stacktrace_string(data_non_contributing_frame)
        assert stacktrace_str == "ZeroDivisionError: division by zero"

    def test_get_stacktrace_string_contributing_exception_no_contributing_frames(self):
        data_no_contributing_frame = copy.deepcopy(BASE_APP_DATA)
        data_no_contributing_frame["app"]["component"]["values"][0]["values"][0][
            "values"
        ] = self.create_frames(1, False)
        stacktrace_str = get_stacktrace_string(data_no_contributing_frame)
        assert stacktrace_str == "ZeroDivisionError: division by zero"

    def test_get_stacktrace_string_no_contributing_exception(self):
        data_no_contributing_frame = copy.deepcopy(BASE_APP_DATA)
        data_no_contributing_frame["app"]["component"]["values"][0]["contributes"] = False
        stacktrace_str = get_stacktrace_string(data_no_contributing_frame)
        assert stacktrace_str == ""

    def test_get_stacktrace_string_non_contributing_frame(self):
        data_non_contributing_frame = copy.deepcopy(BASE_APP_DATA)
        data_non_contributing_frame["app"]["component"]["values"][0]["values"][0][
            "values"
        ] += self.create_frames(1, False)
        stacktrace_str = get_stacktrace_string(data_non_contributing_frame)
        expected_stacktrace_str = 'ZeroDivisionError: division by zero\n  File "python_onboarding.py", function divide_by_zero\n    divide = 1/0'
        assert stacktrace_str == expected_stacktrace_str

    def test_get_stacktrace_string_no_stacktrace(self):
        data_no_stacktrace = copy.deepcopy(BASE_APP_DATA)
        data_no_stacktrace["app"]["component"]["values"].pop(0)
        stacktrace_str = get_stacktrace_string(data_no_stacktrace)
        assert stacktrace_str == ""

    def test_get_stacktrace_string_chained(self):
        stacktrace_str = get_stacktrace_string(CHAINED_APP_DATA)
        expected_stacktrace_str = 'Exception: Catch divide by zero error\n  File "python_onboarding.py", function <module>\n    divide_by_zero()\n  File "python_onboarding.py", function divide_by_zero\n    raise Exception("Catch divide by zero error")\nZeroDivisionError: division by zero\n  File "python_onboarding.py", function divide_by_zero\n    divide = 1/0'
        assert stacktrace_str == expected_stacktrace_str

    def test_get_stacktrace_string_chained_too_many_frames(self):
        data_chained_exception = copy.deepcopy(CHAINED_APP_DATA)
        data_chained_exception["app"]["component"]["values"][0]["values"] = [
            self.create_exception(
                exception_type_str="InnerException",
                exception_value="nope",
                frames=self.create_frames(
                    num_frames=30, context_line_factory=lambda i: f"inner line {i}"
                ),
            ),
            self.create_exception(
                exception_type_str="MiddleException",
                exception_value="un-uh",
                frames=self.create_frames(
                    num_frames=30, context_line_factory=lambda i: f"middle line {i}"
                ),
            ),
            self.create_exception(
                exception_type_str="OuterException",
                exception_value="no way",
                frames=self.create_frames(
                    num_frames=30, context_line_factory=lambda i: f"outer line {i}"
                ),
            ),
        ]
        stacktrace_str = get_stacktrace_string(data_chained_exception)

        # The stacktrace string should be:
        #    30 frames from OuterExcepton (with lines counting up from 1 to 30), followed by
        #    20 frames from MiddleExcepton (with lines counting up from 11 to 30), followed by
        #    no frames from InnerExcepton (though the type and value are in there)
        expected = "".join(
            ["OuterException: no way"]
            + [
                f'\n  File "hello.py", function hello_there\n    outer line {i}'
                for i in range(1, 31)  #
            ]
            + ["\nMiddleException: un-uh"]
            + [
                f'\n  File "hello.py", function hello_there\n    middle line {i}'
                for i in range(11, 31)
            ]
            + ["\nInnerException: nope"]
        )
        assert stacktrace_str == expected

    def test_get_stacktrace_string_thread(self):
        stacktrace_str = get_stacktrace_string(MOBILE_THREAD_DATA)
        assert stacktrace_str == 'File "", function TestHandler'

    def test_get_stacktrace_string_system(self):
        data_system = copy.deepcopy(BASE_APP_DATA)
        data_system["system"] = data_system.pop("app")
        stacktrace_str = get_stacktrace_string(data_system)
        expected_stacktrace_str = 'ZeroDivisionError: division by zero\n  File "python_onboarding.py", function divide_by_zero\n    divide = 1/0'
        assert stacktrace_str == expected_stacktrace_str

    def test_get_stacktrace_string_app_and_system(self):
        data = copy.deepcopy(BASE_APP_DATA)
        data_system = copy.deepcopy(BASE_APP_DATA)
        data_system = data_system.pop("app")
        data_system["component"]["values"][0]["values"][0]["values"] = self.create_frames(1, True)
        data.update({"system": data_system})

        stacktrace_str = get_stacktrace_string(data)
        expected_stacktrace_str = 'ZeroDivisionError: division by zero\n  File "python_onboarding.py", function divide_by_zero\n    divide = 1/0'
        assert stacktrace_str == expected_stacktrace_str

    def test_get_stacktrace_string_no_app_no_system(self):
        data = {"default": "something"}
        stacktrace_str = get_stacktrace_string(data)
        assert stacktrace_str == ""

    def test_get_stacktrace_string_over_50_contributing_frames(self):
        """Check that when there are over 50 contributing frames, the last 50 are included."""

        data_frames = copy.deepcopy(BASE_APP_DATA)
        # Create 30 contributing frames, 1-30 -> last 20 should be included
        data_frames["app"]["component"]["values"][0]["values"][0]["values"] = self.create_frames(
            30, True
        )
        # Create 20 non-contributing frames, 31-50 -> none should be included
        data_frames["app"]["component"]["values"][0]["values"][0]["values"] += self.create_frames(
            20, False, 31
        )
        # Create 30 contributing frames, 51-80 -> all should be included
        data_frames["app"]["component"]["values"][0]["values"][0]["values"] += self.create_frames(
            30, True, 51
        )
        stacktrace_str = get_stacktrace_string(data_frames)

        num_frames = 0
        for i in range(1, 11):
            assert ("test = " + str(i) + "!") not in stacktrace_str
        for i in range(11, 31):
            num_frames += 1
            assert ("test = " + str(i) + "!") in stacktrace_str
        for i in range(31, 51):
            assert ("test = " + str(i) + "!") not in stacktrace_str
        for i in range(51, 81):
            num_frames += 1
            assert ("test = " + str(i) + "!") in stacktrace_str
        assert num_frames == 50

    def test_get_stacktrace_string_no_exception(self):
        data_no_exception = copy.deepcopy(BASE_APP_DATA)
        data_no_exception["app"]["component"]["values"][0]["id"] = "not-exception"
        stacktrace_str = get_stacktrace_string(data_no_exception)
        assert stacktrace_str == ""

    def test_get_formatted_results(self):
        event_from_second_similar_group = save_new_event(
            {"message": "Adopt don't shop"}, self.project
        )

        similar_issue_data_1 = SeerSimilarIssueData(
            message_distance=0.05,
            parent_group_id=NonNone(self.similar_event.group_id),
            parent_hash=NonNone(self.similar_event.get_primary_hash()),
            should_group=True,
            stacktrace_distance=0.01,
        )
        similar_issue_data_2 = SeerSimilarIssueData(
            message_distance=0.49,
            parent_group_id=NonNone(event_from_second_similar_group.group_id),
            parent_hash=NonNone(event_from_second_similar_group.get_primary_hash()),
            should_group=False,
            stacktrace_distance=0.23,
        )
        group_similar_endpoint = GroupSimilarIssuesEmbeddingsEndpoint()
        formatted_results = group_similar_endpoint.get_formatted_results(
            similar_issues_data=[similar_issue_data_1, similar_issue_data_2], user=self.user
        )
        assert formatted_results == self.get_expected_response(
            [
                NonNone(self.similar_event.group_id),
                NonNone(event_from_second_similar_group.group_id),
            ],
            [0.95, 0.51],
            [0.99, 0.77],
            ["Yes", "No"],
        )

    def test_no_feature_flag(self):
        response = self.client.get(self.path)

        assert response.status_code == 404, response.content

    # TODO: Remove once switch is complete
    @with_feature("projects:similarity-embeddings")
    @mock.patch("sentry.seer.utils.metrics")
    @mock.patch("sentry.seer.utils.seer_grouping_connection_pool.urlopen")
    @mock.patch("sentry.api.endpoints.group_similar_issues_embeddings.logger")
    def test_simple_only_group_id_returned(self, mock_logger, mock_seer_request, mock_metrics):
        seer_return_value: SimilarIssuesEmbeddingsResponse = {
            "responses": [
                {
                    "message_distance": 0.05,
                    "parent_group_id": NonNone(self.similar_event.group_id),
                    "should_group": True,
                    "stacktrace_distance": 0.01,
                }
            ]
        }
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value))

        response = self.client.get(
            self.path,
            data={"k": "1", "threshold": "0.01"},
        )

        assert response.data == self.get_expected_response(
            [NonNone(self.similar_event.group_id)], [0.95], [0.99], ["Yes"]
        )

        expected_seer_request_params = {
            "threshold": 0.01,
            "group_id": self.group.id,
            "hash": NonNone(self.event.get_primary_hash()),
            "project_id": self.project.id,
            "stacktrace": EXPECTED_STACKTRACE_STRING,
            "message": self.group.message,
            "k": 1,
        }

        mock_seer_request.assert_called_with(
            "POST",
            SEER_SIMILAR_ISSUES_URL,
            body=orjson.dumps(expected_seer_request_params).decode(),
            headers={"Content-Type": "application/json;charset=utf-8"},
        )

        expected_seer_request_params["group_message"] = expected_seer_request_params.pop("message")
        mock_logger.info.assert_called_with(
            "Similar issues embeddings parameters", extra=expected_seer_request_params
        )
        mock_metrics.incr.assert_any_call(
            "seer.similar_issue_request.parent_issue", tags={"outcome": "found"}
        )

    @with_feature("projects:similarity-embeddings")
    @mock.patch("sentry.seer.utils.metrics")
    @mock.patch("sentry.seer.utils.seer_grouping_connection_pool.urlopen")
    @mock.patch("sentry.api.endpoints.group_similar_issues_embeddings.logger")
    def test_simple_only_hash_returned(self, mock_logger, mock_seer_request, mock_metrics):
        seer_return_value: SimilarIssuesEmbeddingsResponse = {
            "responses": [
                {
                    "message_distance": 0.05,
                    "parent_hash": NonNone(self.similar_event.get_primary_hash()),
                    "should_group": True,
                    "stacktrace_distance": 0.01,
                }
            ]
        }
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value))

        response = self.client.get(
            self.path,
            data={"k": "1", "threshold": "0.01"},
        )

        assert response.data == self.get_expected_response(
            [NonNone(self.similar_event.group_id)], [0.95], [0.99], ["Yes"]
        )

        expected_seer_request_params = {
            "threshold": 0.01,
            "group_id": self.group.id,
            "hash": NonNone(self.event.get_primary_hash()),
            "project_id": self.project.id,
            "stacktrace": EXPECTED_STACKTRACE_STRING,
            "message": self.group.message,
            "k": 1,
        }

        mock_seer_request.assert_called_with(
            "POST",
            SEER_SIMILAR_ISSUES_URL,
            body=orjson.dumps(expected_seer_request_params).decode(),
            headers={"Content-Type": "application/json;charset=utf-8"},
        )

        expected_seer_request_params["group_message"] = expected_seer_request_params.pop("message")
        mock_logger.info.assert_called_with(
            "Similar issues embeddings parameters", extra=expected_seer_request_params
        )
        mock_metrics.incr.assert_any_call(
            "seer.similar_issue_request.parent_issue", tags={"outcome": "found"}
        )

    # TODO: Remove once switch is complete
    @with_feature("projects:similarity-embeddings")
    @mock.patch("sentry.seer.utils.metrics")
    @mock.patch("sentry.seer.utils.seer_grouping_connection_pool.urlopen")
    @mock.patch("sentry.api.endpoints.group_similar_issues_embeddings.logger")
    def test_simple_group_id_and_hash_returned(self, mock_logger, mock_seer_request, mock_metrics):
        seer_return_value: SimilarIssuesEmbeddingsResponse = {
            "responses": [
                {
                    "message_distance": 0.05,
                    "parent_group_id": NonNone(self.similar_event.group_id),
                    "parent_hash": NonNone(self.similar_event.get_primary_hash()),
                    "should_group": True,
                    "stacktrace_distance": 0.01,
                }
            ]
        }
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value))

        response = self.client.get(
            self.path,
            data={"k": "1", "threshold": "0.01"},
        )

        assert response.data == self.get_expected_response(
            [NonNone(self.similar_event.group_id)], [0.95], [0.99], ["Yes"]
        )

        expected_seer_request_params = {
            "threshold": 0.01,
            "group_id": self.group.id,
            "hash": NonNone(self.event.get_primary_hash()),
            "project_id": self.project.id,
            "stacktrace": EXPECTED_STACKTRACE_STRING,
            "message": self.group.message,
            "k": 1,
        }

        mock_seer_request.assert_called_with(
            "POST",
            SEER_SIMILAR_ISSUES_URL,
            body=orjson.dumps(expected_seer_request_params).decode(),
            headers={"Content-Type": "application/json;charset=utf-8"},
        )

        expected_seer_request_params["group_message"] = expected_seer_request_params.pop("message")
        mock_logger.info.assert_called_with(
            "Similar issues embeddings parameters", extra=expected_seer_request_params
        )
        mock_metrics.incr.assert_any_call(
            "seer.similar_issue_request.parent_issue", tags={"outcome": "found"}
        )

    @with_feature("projects:similarity-embeddings")
    @mock.patch("sentry.analytics.record")
    @mock.patch("sentry.seer.utils.seer_grouping_connection_pool.urlopen")
    def test_multiple(self, mock_seer_request, mock_record):
        over_threshold_group_event = save_new_event({"message": "Maisey is silly"}, self.project)
        under_threshold_group_event = save_new_event({"message": "Charlie is goofy"}, self.project)

        seer_return_value: SimilarIssuesEmbeddingsResponse = {
            "responses": [
                {
                    "message_distance": 0.05,
                    "parent_group_id": NonNone(self.similar_event.group_id),
                    "parent_hash": NonNone(self.similar_event.get_primary_hash()),
                    "should_group": True,
                    "stacktrace_distance": 0.002,  # Over threshold
                },
                {
                    "message_distance": 0.05,
                    "parent_group_id": NonNone(over_threshold_group_event.group_id),
                    "parent_hash": NonNone(over_threshold_group_event.get_primary_hash()),
                    "should_group": True,
                    "stacktrace_distance": 0.002,  # Over threshold
                },
                {
                    "message_distance": 0.05,
                    "parent_group_id": NonNone(under_threshold_group_event.group_id),
                    "parent_hash": NonNone(under_threshold_group_event.get_primary_hash()),
                    "should_group": False,
                    "stacktrace_distance": 0.05,  # Under threshold
                },
            ]
        }
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value))

        response = self.client.get(
            self.path,
            data={"k": "1", "threshold": "0.01"},
        )

        assert response.data == self.get_expected_response(
            [
                NonNone(self.similar_event.group_id),
                NonNone(over_threshold_group_event.group_id),
                NonNone(under_threshold_group_event.group_id),
            ],
            [0.95, 0.95, 0.95],
            [0.998, 0.998, 0.95],
            ["Yes", "Yes", "No"],
        )

        mock_record.assert_called_with(
            "group_similar_issues_embeddings.count",
            organization_id=self.org.id,
            project_id=self.project.id,
            group_id=self.group.id,
            hash=NonNone(self.event.get_primary_hash()),
            count_over_threshold=2,
            user_id=self.user.id,
        )

    @with_feature("projects:similarity-embeddings")
    @mock.patch("sentry.seer.utils.metrics")
    @mock.patch("sentry.seer.utils.logger")
    @mock.patch("sentry.seer.utils.seer_grouping_connection_pool.urlopen")
    def test_incomplete_return_data(self, mock_seer_request, mock_logger, mock_metrics):
        # Two suggested groups, one with valid data, one missing both parent group id and parent hash.
        # We should log the second and return the first.
        seer_return_value: SimilarIssuesEmbeddingsResponse = {
            "responses": [
                {
                    "message_distance": 0.05,
                    "parent_group_id": NonNone(self.similar_event.group_id),
                    "parent_hash": NonNone(self.similar_event.get_primary_hash()),
                    "should_group": True,
                    "stacktrace_distance": 0.01,
                },
                {
                    "message_distance": 0.05,
                    # missing both parent group id and parent hash
                    "should_group": True,
                    "stacktrace_distance": 0.01,
                },
            ]
        }
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value))
        response = self.client.get(self.path)

        mock_logger.exception.assert_called_with(
            "Seer similar issues response missing both `parent_group_id` and `parent_hash`",
            extra={
                "request_params": {
                    "group_id": NonNone(self.event.group_id),
                    "hash": NonNone(self.event.get_primary_hash()),
                    "project_id": self.project.id,
                    "stacktrace": EXPECTED_STACKTRACE_STRING,
                    "message": self.group.message,
                },
                "raw_similar_issue_data": {
                    "message_distance": 0.05,
                    "should_group": True,
                    "stacktrace_distance": 0.01,
                },
            },
        )
        mock_metrics.incr.assert_any_call(
            "seer.similar_issue_request.parent_issue", tags={"outcome": "found"}
        )
        mock_metrics.incr.assert_any_call(
            "seer.similar_issue_request.parent_issue", tags={"outcome": "incomplete_data"}
        )

        assert response.data == self.get_expected_response(
            [NonNone(self.similar_event.group_id)], [0.95], [0.99], ["Yes"]
        )

    @with_feature("projects:similarity-embeddings")
    @mock.patch("sentry.seer.utils.metrics")
    @mock.patch("sentry.seer.utils.seer_grouping_connection_pool.urlopen")
    def test_nonexistent_group(self, mock_seer_request, mock_metrics):
        """
        The seer API can return groups that do not exist if they have been deleted/merged.
        Test that these groups are not returned.
        """
        seer_return_value: SimilarIssuesEmbeddingsResponse = {
            # Two suggested groups, one with valid data, one pointing to a group that doesn't exist.
            # We should log the second and return the first.
            "responses": [
                {
                    "message_distance": 0.05,
                    "parent_group_id": NonNone(self.similar_event.group_id),
                    "parent_hash": NonNone(self.similar_event.get_primary_hash()),
                    "should_group": True,
                    "stacktrace_distance": 0.01,
                },
                {
                    "message_distance": 0.05,
                    "parent_group_id": 1121201212312012,  # too high to be real
                    "parent_hash": "not a real hash",
                    "should_group": True,
                    "stacktrace_distance": 0.01,
                },
            ]
        }
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value))
        response = self.client.get(self.path)

        mock_metrics.incr.assert_any_call(
            "seer.similar_issue_request.parent_issue", tags={"outcome": "not_found"}
        )
        assert response.data == self.get_expected_response(
            [NonNone(self.similar_event.group_id)], [0.95], [0.99], ["Yes"]
        )

    @with_feature("projects:similarity-embeddings")
    @mock.patch("sentry.analytics.record")
    @mock.patch("sentry.seer.utils.seer_grouping_connection_pool.urlopen")
    def test_empty_seer_return(self, mock_seer_request, mock_record):
        mock_seer_request.return_value = HTTPResponse([])
        response = self.client.get(self.path)
        assert response.data == []

        mock_record.assert_called_with(
            "group_similar_issues_embeddings.count",
            organization_id=self.org.id,
            project_id=self.project.id,
            group_id=self.group.id,
            hash=NonNone(self.event.get_primary_hash()),
            count_over_threshold=0,
            user_id=self.user.id,
        )

    @with_feature("projects:similarity-embeddings")
    def test_no_contributing_exception(self):
        data_no_contributing_exception = {
            "fingerprint": ["message"],
            "message": "Message",
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "divide_by_zero",
                                    "module": "__main__",
                                    "filename": "python_onboarding.py",
                                    "abs_path": "/Users/jodi/python_onboarding/python_onboarding.py",
                                    "lineno": 20,
                                    "context_line": " divide = 1/0",
                                    "in_app": False,
                                },
                            ]
                        },
                        "type": "ZeroDivisionError",
                        "value": "division by zero",
                    }
                ]
            },
            "platform": "python",
        }
        event_no_contributing_exception = self.store_event(
            data=data_no_contributing_exception, project_id=self.project
        )
        group_no_contributing_exception = event_no_contributing_exception.group
        assert group_no_contributing_exception

        response = self.client.get(
            f"/api/0/issues/{group_no_contributing_exception.id}/similar-issues-embeddings/",
            data={"k": "1", "threshold": "0.98"},
        )

        assert response.data == []

    @with_feature("projects:similarity-embeddings")
    def test_no_exception(self):
        event_no_exception = self.store_event(data={}, project_id=self.project)
        group_no_exception = event_no_exception.group
        assert group_no_exception
        response = self.client.get(
            f"/api/0/issues/{group_no_exception.id}/similar-issues-embeddings/",
            data={"k": "1", "threshold": "0.98"},
        )

        assert response.data == []

    @with_feature("projects:similarity-embeddings")
    @mock.patch("sentry.seer.utils.seer_grouping_connection_pool.urlopen")
    def test_no_optional_params(self, mock_seer_request):
        """
        Test that optional parameters, k and threshold, can not be included.
        """
        seer_return_value: SimilarIssuesEmbeddingsResponse = {
            "responses": [
                {
                    "message_distance": 0.05,
                    "parent_group_id": NonNone(self.similar_event.group_id),
                    "parent_hash": NonNone(self.similar_event.get_primary_hash()),
                    "should_group": True,
                    "stacktrace_distance": 0.01,
                }
            ]
        }

        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value))

        # Include no optional parameters
        response = self.client.get(self.path)
        assert response.data == self.get_expected_response(
            [NonNone(self.similar_event.group_id)], [0.95], [0.99], ["Yes"]
        )

        mock_seer_request.assert_called_with(
            "POST",
            SEER_SIMILAR_ISSUES_URL,
            body=orjson.dumps(
                {
                    "threshold": 0.01,
                    "group_id": self.group.id,
                    "hash": NonNone(self.event.get_primary_hash()),
                    "project_id": self.project.id,
                    "stacktrace": EXPECTED_STACKTRACE_STRING,
                    "message": self.group.message,
                },
            ).decode(),
            headers={"Content-Type": "application/json;charset=utf-8"},
        )

        # Include k
        response = self.client.get(
            self.path,
            data={"k": 1},
        )
        assert response.data == self.get_expected_response(
            [NonNone(self.similar_event.group_id)], [0.95], [0.99], ["Yes"]
        )

        mock_seer_request.assert_called_with(
            "POST",
            SEER_SIMILAR_ISSUES_URL,
            body=orjson.dumps(
                {
                    "threshold": 0.01,
                    "group_id": self.group.id,
                    "hash": NonNone(self.event.get_primary_hash()),
                    "project_id": self.project.id,
                    "stacktrace": EXPECTED_STACKTRACE_STRING,
                    "message": self.group.message,
                    "k": 1,
                },
            ).decode(),
            headers={"Content-Type": "application/json;charset=utf-8"},
        )

        # Include threshold
        response = self.client.get(
            self.path,
            data={"threshold": "0.01"},
        )
        assert response.data == self.get_expected_response(
            [NonNone(self.similar_event.group_id)], [0.95], [0.99], ["Yes"]
        )

        mock_seer_request.assert_called_with(
            "POST",
            SEER_SIMILAR_ISSUES_URL,
            body=orjson.dumps(
                {
                    "threshold": 0.01,
                    "group_id": self.group.id,
                    "hash": NonNone(self.event.get_primary_hash()),
                    "project_id": self.project.id,
                    "stacktrace": EXPECTED_STACKTRACE_STRING,
                    "message": self.group.message,
                },
            ).decode(),
            headers={"Content-Type": "application/json;charset=utf-8"},
        )
