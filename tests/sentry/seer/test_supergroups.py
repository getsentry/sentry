from unittest.mock import patch

from sentry.seer.supergroups import trigger_supergroups_embedding
from sentry.testutils.cases import TestCase


class TriggerSupergroupsEmbeddingTest(TestCase):
    @patch("sentry.seer.supergroups.make_supergroups_embedding_request")
    def test_calls_seer_with_correct_payload(self, mock_request):
        mock_request.return_value.status = 200

        trigger_supergroups_embedding(
            organization_id=1,
            group_id=123,
            artifact_data={"one_line_description": "Null pointer in auth module"},
        )

        mock_request.assert_called_once()
        call_args = mock_request.call_args
        assert call_args.kwargs["timeout"] == 5

        # First positional arg is the typed dict body
        payload = call_args.args[0]
        assert payload["organization_id"] == 1
        assert payload["group_id"] == 123
        assert payload["artifact_data"] == {"one_line_description": "Null pointer in auth module"}
