import json

from mock import patch

from sentry import options
from sentry.testutils import TestCase
from sentry.receivers import set_sentry_version
from sentry.tasks.check_update import check_update, PYPI_URL


class CheckUpdateTest(TestCase):

    OLD = '5.0.0'
    CURRENT = '5.5.0-DEV'
    NEW = '1000000000.5.1'

    KEY = 'sentry:latest_version'

    @patch('sentry.tasks.check_update.safe_urlopen')
    @patch('sentry.tasks.check_update.safe_urlread')
    def test_run_check_update_task(self, safe_urlread, safe_urlopen):
        safe_urlread.return_value = json.dumps({'info': {'version': self.NEW}})

        check_update()  # latest_version > current_version

        safe_urlopen.assert_called_once_with(PYPI_URL)
        safe_urlread.assert_called_once_with(safe_urlopen.return_value)

        self.assertEqual(options.get(key=self.KEY), self.NEW)

    @patch('sentry.tasks.check_update.safe_urlopen')
    @patch('sentry.tasks.check_update.safe_urlread')
    def test_run_check_update_task_with_bad_response(self, safe_urlread,
                                                     safe_urlopen):
        safe_urlread.return_value = ''

        check_update()  # latest_version == current_version

        safe_urlopen.assert_called_once_with(PYPI_URL)
        safe_urlread.assert_called_once_with(safe_urlopen.return_value)

        self.assertEqual(options.get(key=self.KEY), '')

    def test_set_sentry_version_empty_latest(self):
        set_sentry_version(latest=self.NEW)
        self.assertEqual(options.get(key=self.KEY), self.NEW)

    @patch('sentry.get_version')
    def test_set_sentry_version_new(self, get_version):
        options.set(self.KEY, self.OLD)

        get_version.return_value = self.CURRENT

        set_sentry_version(latest=self.NEW)

        self.assertEqual(options.get(key=self.KEY), self.NEW)

    @patch('sentry.get_version')
    def test_set_sentry_version_old(self, get_version):
        options.set(self.KEY, self.NEW)

        get_version.return_value = self.CURRENT

        set_sentry_version(latest=self.OLD)

        self.assertEqual(options.get(key=self.KEY), self.NEW)
