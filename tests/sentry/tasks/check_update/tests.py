import json

import mock

from sentry.plugins.helpers import get_option, set_option
from sentry.testutils import TestCase
from sentry.models import set_sentry_version, Option
from sentry.tasks.check_update import check_update, PYPI_URL


class CheckUpdateTest(TestCase):

    OLD = '5.0.0'
    CURRENT = '5.5.0-DEV'
    NEW = '1000000000.5.1'

    KEY = 'sentry:latest_version'

    def test_run_check_update_task(self):
        with mock.patch('sentry.tasks.check_update.fetch_url_content') as fetch:
            fetch.return_value = (
                None, None, json.dumps({'info': {'version': self.NEW}})
            )
            check_update()  # latest_version > current_version
            fetch.assert_called_once_with(PYPI_URL)

        self.assertEqual(get_option(key=self.KEY), self.NEW)

    def test_run_check_update_task_with_bad_response(self):
        with mock.patch('sentry.tasks.check_update.fetch_url_content') as fetch:
            fetch.return_value = (None, None, '')
            check_update()  # latest_version == current_version
            fetch.assert_called_once_with(PYPI_URL)

        self.assertEqual(get_option(key=self.KEY), None)

    def test_set_sentry_version_empty_latest(self):
        set_sentry_version(latest=self.NEW)
        self.assertEqual(get_option(key=self.KEY), self.NEW)

    def test_set_sentry_version_new(self):
        set_option(self.KEY, self.OLD)

        with mock.patch('sentry.get_version') as get_version:
            get_version.return_value = self.CURRENT

            set_sentry_version(latest=self.NEW)

        self.assertEqual(Option.objects.get_value(key=self.KEY), self.NEW)

    def test_set_sentry_version_old(self):
        set_option(self.KEY, self.NEW)

        with mock.patch('sentry.get_version') as get_version:
            get_version.return_value = self.CURRENT

            set_sentry_version(latest=self.OLD)

        self.assertEqual(Option.objects.get_value(key=self.KEY), self.NEW)
