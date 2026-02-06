from unittest.mock import patch

import orjson
from django.conf import settings

from sentry.seer.supergroups import trigger_supergroups_embedding
from sentry.testutils.cases import TestCase


class TriggerSupergroupsEmbeddingTest(TestCase):
    @patch("sentry.seer.supergroups.requests.post")
    @patch("sentry.seer.supergroups.sign_with_seer_secret", return_value={})
    def test_calls_seer_with_correct_payload(self, mock_sign, mock_post):
        mock_post.return_value.raise_for_status.return_value = None

        trigger_supergroups_embedding(
            organization_id=1,
            group_id=123,
            artifact_data={"one_line_description": "Null pointer in auth module"},
        )

        mock_post.assert_called_once()
        assert mock_post.call_args.args[0] == f"{settings.SEER_AUTOFIX_URL}/v0/issues/supergroups"
        assert mock_post.call_args.kwargs["timeout"] == 5

        mock_sign.assert_called_once()
        payload = orjson.loads(mock_sign.call_args.args[0])
        assert payload["organization_id"] == 1
        assert payload["group_id"] == 123
        assert payload["artifact_data"] == {"one_line_description": "Null pointer in auth module"}
