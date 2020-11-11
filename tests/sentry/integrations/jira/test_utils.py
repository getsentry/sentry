from __future__ import absolute_import

from sentry.integrations.jira.utils import build_user_choice
from sentry.testutils import TestCase
from sentry.utils import json
from .testutils import EXAMPLE_JIRA_SERVER_USER, EXAMPLE_JIRA_CLOUD_USER


class BuildUserChoiceTest(TestCase):
    def test_jira_server(self):
        user_response = json.loads(EXAMPLE_JIRA_SERVER_USER)
        assert build_user_choice(user_response, user_id_field="name") == (
            "bob",
            "Bobby - bob@example.org (bob)",
        )

    def test_jira_cloud(self):
        user_response = json.loads(EXAMPLE_JIRA_CLOUD_USER)
        assert build_user_choice(user_response, user_id_field="accountId") == (
            "012345:00000000-1111-2222-3333-444444444444",
            "Saif Hakim",
        )

    def test_unexpected_id(self):
        user_response = json.loads(EXAMPLE_JIRA_CLOUD_USER)
        assert build_user_choice(user_response, user_id_field="name") is None
