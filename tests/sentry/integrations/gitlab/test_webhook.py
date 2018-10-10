from __future__ import absolute_import

from sentry.testutils import APITestCase

import pytest


class WebhookTest(APITestCase):
    url = '/extensions/gitlab/webhook'

    @pytest.mark.incomplete
    def test_get(self):
        pass

    @pytest.mark.incomplete
    def test_invalid_secret(self):
        pass

    @pytest.mark.incomplete
    def test_push_event_create_repo(self):
        pass

    @pytest.mark.incomplete
    def test_push_event_create_commits(self):
        pass

    @pytest.mark.incomplete
    def test_push_event_ignore_commit(self):
        pass

    @pytest.mark.incomplete
    def test_push_event_create_commits_more_than_20(self):
        pass

    @pytest.mark.incomplete
    def test_push_event_known_author(self):
        pass

    @pytest.mark.incomplete
    def test_push_event_unknown_author(self):
        pass

    @pytest.mark.incomplete
    def test_push_event_suspect_commit(self):
        pass

    @pytest.mark.incomplete
    def test_merge_event_create_repo(self):
        pass

    @pytest.mark.incomplete
    def test_merge_event_create_commits(self):
        pass

    @pytest.mark.incomplete
    def test_merge_event_create_commits_more_than_20(self):
        pass

    @pytest.mark.incomplete
    def test_merge_event_link_author(self):
        pass
