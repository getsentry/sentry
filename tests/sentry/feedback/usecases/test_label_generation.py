import pytest
import requests
import responses

from sentry.feedback.usecases.label_generation import SEER_GENERATE_LABELS_URL, generate_labels
from sentry.testutils.cases import TestCase
from sentry.utils import json


def mock_seer_response(**kwargs) -> None:
    """Use with @responses.activate to cleanup after tests. Not compatible with store_replay."""
    responses.add(
        responses.POST,
        SEER_GENERATE_LABELS_URL,
        **kwargs,
    )


class TestGenerateLabels(TestCase):
    @responses.activate
    def test_generate_labels_success_response(self):
        mock_seer_response(
            status=200,
            body=b'{"data": {"labels": ["User Interface", "Navigation", "Right Sidebar"]}}',
        )

        labels = generate_labels(
            "I don't like the new right sidebar, it makes navigating everywhere hard!", 1
        )

        test_request = responses.calls[0].request
        test_response = responses.calls[0].response

        assert labels == ["User Interface", "Navigation", "Right Sidebar"]
        assert json.loads(test_request.body) == {
            "feedback_message": "I don't like the new right sidebar, it makes navigating everywhere hard!",
            "organization_id": 1,
        }
        assert test_response.status_code == 200

    @responses.activate
    def test_generate_labels_failed_response(self):
        mock_seer_response(
            status=500,
            body=b'{"error": "Internal Server Error"}',
        )

        with pytest.raises(requests.exceptions.HTTPError):
            generate_labels(
                "I don't like the new right sidebar, it makes navigating everywhere hard!", 1
            )

        test_request = responses.calls[0].request
        test_response = responses.calls[0].response

        assert test_response.status_code == 500
        assert json.loads(test_request.body) == {
            "feedback_message": "I don't like the new right sidebar, it makes navigating everywhere hard!",
            "organization_id": 1,
        }

    @responses.activate
    def test_generate_labels_network_error(self):
        mock_seer_response(body=requests.exceptions.Timeout("Request timed out"))

        with pytest.raises(requests.exceptions.Timeout):
            generate_labels(
                "I don't like the new right sidebar, it makes navigating everywhere hard!", 1
            )

        test_request = responses.calls[0].request

        assert len(responses.calls) == 1
        assert json.loads(test_request.body) == {
            "feedback_message": "I don't like the new right sidebar, it makes navigating everywhere hard!",
            "organization_id": 1,
        }
