from unittest.mock import patch

import pytest

from sentry.feedback.usecases.label_generation import generate_labels
from sentry.testutils.cases import TestCase


class TestGenerateLabels(TestCase):
    @patch("sentry.feedback.usecases.label_generation.requests.post")
    def test_generate_labels_success_response(self, mock_post):
        mock_response = mock_post.return_value
        mock_response.raise_for_status = lambda: None
        mock_response.status_code = 200
        mock_response.content = (
            b'{"data": {"labels": ["User Interface", "Navigation", "Right Sidebar"]}}'
        )

        labels = generate_labels(
            "I don't like the new right sidebar, it makes navigating everywhere hard!", 1
        )

        assert labels == ["User Interface", "Navigation", "Right Sidebar"]
        assert mock_post.call_count == 1

    @patch("sentry.feedback.usecases.label_generation.requests.post")
    def test_generate_labels_failed_response(self, mock_post):
        mock_response = mock_post.return_value
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        with pytest.raises(Exception, match="Failed to generate labels: 500 Internal Server Error"):
            generate_labels(
                "I don't like the new right sidebar, it makes navigating everywhere hard!", 1
            )

    @patch("sentry.feedback.usecases.label_generation.requests.post")
    def test_generate_labels_network_error(self, mock_post):
        mock_post.side_effect = Exception("Connection timeout")

        with pytest.raises(Exception, match="Connection timeout"):
            generate_labels(
                "I don't like the new right sidebar, it makes navigating everywhere hard!", 1
            )
