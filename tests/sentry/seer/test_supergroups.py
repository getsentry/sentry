from unittest.mock import patch

import orjson

from sentry.seer.supergroups import trigger_supergroups_embedding
from sentry.testutils.cases import TestCase


class TriggerSupergroupsEmbeddingTest(TestCase):
    @patch("sentry.seer.supergroups.make_signed_seer_api_request")
    def test_calls_seer_with_correct_payload(self, mock_request):
        mock_request.return_value.status = 200

        trigger_supergroups_embedding(
            organization_id=1,
            group_id=123,
            artifact_data={"one_line_description": "Null pointer in auth module"},
        )

        mock_request.assert_called_once()
        # First arg is connection pool, second is path
        call_args = mock_request.call_args
        assert "/v0/issues/supergroups" in call_args.args[1]
        assert call_args.kwargs["timeout"] == 5

        # Third arg is the body (payload)
        payload = orjson.loads(call_args.args[2])
        assert payload["organization_id"] == 1
        assert payload["group_id"] == 123
        assert payload["artifact_data"] == {"one_line_description": "Null pointer in auth module"}
