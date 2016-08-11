from __future__ import absolute_import

from mock import patch

from sentry.lang.javascript.filters import filter_event, is_extension
from sentry.models import ProjectOption
from sentry.testutils import TestCase


class FilterEventsTest(TestCase):
    def test_bails_without_javascript_event(self):
        project = self.create_project()
        data = {
            'platform': 'python'
        }

        result = filter_event(project, data)
        assert result is None

    @patch('sentry.lang.javascript.filters.is_extension')
    def test_doesnt_filter_extensions_by_default(self, mock_is_extension):
        project = self.create_project()
        data = {
            'platform': 'javascript',
        }

        result = filter_event(project, data)
        assert not result
        assert not mock_is_extension.called

    @patch('sentry.lang.javascript.filters.is_extension')
    def test_filters_based_on_result_of_is_extension(self, mock_is_extension):
        mock_is_extension.return_value = True

        project = self.create_project()

        ProjectOption.objects.set_value(
            project=project,
            key='javascript:filter-extensions',
            value='1',
        )
        data = {
            'platform': 'javascript',
        }

        result = filter_event(project, data)
        assert result is True
        mock_is_extension.assert_called_once_with(data)

        mock_is_extension.return_value = False

        data = {
            'platform': 'javascript',
        }

        result = filter_event(project, data)
        assert result is False


class IsExtensionTest(TestCase):
    def get_mock_data(self, exc_value=None, exc_source=None):
        return {
            'platform': 'javascript',
            'sentry.interfaces.Exception': {
                'values': [
                    {
                        'type': 'Error',
                        'value': exc_value or 'undefined is not defined',
                        'stacktrace': {
                            'frames': [
                                {
                                    'abs_path': 'http://example.com/foo.js'
                                },
                                {
                                    'abs_path': exc_source or 'http://example.com/bar.js'
                                },
                            ],
                        }
                    }
                ]
            }
        }

    def test_filters_conduit_toolbar(self):
        data = self.get_mock_data(exc_value='what does conduitPage even do')
        assert is_extension(data)

    def test_filters_chrome_extensions(self):
        data = self.get_mock_data(exc_source='chrome://my-extension/or/something')
        assert is_extension(data)

    def test_does_not_filter_generic_data(self):
        data = self.get_mock_data()
        assert not is_extension(data)
