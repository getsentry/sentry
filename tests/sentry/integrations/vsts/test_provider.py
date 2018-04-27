
from __future__ import absolute_import
from mock import Mock
from sentry.identity.vsts.provider import ConfigView
from sentry.testutils import TestCase


class TestConfigView(TestCase):
    def setUp(self):
        self.instance = 'example.visualstudio.com'
        self.default_project = 'MyFirstProject'
        self.config_view = ConfigView()
        self.request = Mock()
        self.pipeline = Mock()

    def test_instance_only(self):
        self.request.POST = {
            'instance': self.instance,
        }
        self.config_view.dispatch(self.request, self.pipeline)

        assert self.pipeline.bind_state.call_count == 1
        assert self.pipeline.next_step.call_count == 0

    def test_no_instance(self):
        self.request.POST = {
            'default_project': self.instance,
        }
        self.config_view.dispatch(self.request, self.pipeline)
        assert self.pipeline.bind_state.call_count == 0
        assert self.pipeline.next_step.call_count == 0

    def test_completed_form(self):
        self.request.POST = {
            'instance': self.instance,
            'default_project': self.instance,
        }
        self.config_view.dispatch(self.request, self.pipeline)
        assert self.pipeline.bind_state.call_count == 2
        assert self.pipeline.next_step.call_count == 1


class TestVSTSOAuthCallbackView(TestCase):
    pass
