from __future__ import absolute_import

import logging
import six
import types

from sentry.utils.compat.mock import patch, PropertyMock

from sentry.mediators import Mediator, Param
from sentry.models import User
from sentry.testutils import TestCase
from sentry.testutils.helpers.faux import faux


class Double(object):
    def __init__(self, **kwargs):
        for k, v in six.iteritems(kwargs):
            setattr(self, k, v)


class MockMediator(Mediator):
    user = Param(dict)
    name = Param(six.string_types, default=lambda self: self.user["name"])
    age = Param(int, required=False)

    def call(self):
        with self.log():
            pass


class TestMediator(TestCase):
    def setUp(self):
        super(TestCase, self).setUp()

        self.logger = logging.getLogger("test-mediator")
        self.mediator = MockMediator(user={"name": "Example"}, age=30, logger=self.logger)

    def test_must_implement_call(self):
        del MockMediator.call

        with self.assertRaises(NotImplementedError):
            MockMediator.run(user={"name": "Example"})

    def test_validate_params(self):
        with self.assertRaises(TypeError):
            MockMediator.run(user=False)

    def test_param_access(self):
        assert self.mediator.user == {"name": "Example"}
        assert self.mediator.age == 30

    def test_param_default_access(self):
        assert self.mediator.name == "Example"

    def test_missing_params(self):
        with self.assertRaises(AttributeError):
            MockMediator.run(name="Pete", age=30)

    def test_log(self):
        with patch.object(self.logger, "info") as mock:
            self.mediator.log(at="test")

        mock.assert_called_with(None, extra={"at": "test"})

    @patch(
        "sentry.app.env",
        new_callable=PropertyMock(
            return_value=Double(
                request=Double(resolver_match=Double(kwargs={"organization_slug": "beep"}))
            )
        ),
    )
    def test_log_with_request_org(self, _):
        with patch.object(self.logger, "info") as log:
            self.mediator.log(at="test")
            assert faux(log).kwarg_equals("extra.org", "beep")

    @patch(
        "sentry.app.env",
        new_callable=PropertyMock(
            return_value=Double(request=Double(resolver_match=Double(kwargs={"team_slug": "foo"})))
        ),
    )
    def test_log_with_request_team(self, _):
        with patch.object(self.logger, "info") as log:
            self.mediator.log(at="test")
            assert faux(log).kwarg_equals("extra.team", "foo")

    @patch(
        "sentry.app.env",
        new_callable=PropertyMock(
            return_value=Double(
                request=Double(resolver_match=Double(kwargs={"project_slug": "bar"}))
            )
        ),
    )
    def test_log_with_request_project(self, _):
        with patch.object(self.logger, "info") as log:
            self.mediator.log(at="test")
            assert faux(log).kwarg_equals("extra.project", "bar")

    def test_log_start(self):
        with patch.object(self.logger, "info") as mock:
            self.mediator.call()

        assert faux(mock, 0).args_equals(None)
        assert faux(mock, 0).kwarg_equals("extra.at", "start")

    def test_log_finish(self):
        with patch.object(self.logger, "info") as mock:
            self.mediator.call()

        assert faux(mock).kwarg_equals("extra.at", "finish")

    def test_log_exception(self):
        def call(self):
            with self.log():
                raise TypeError

        setattr(self.mediator, "call", types.MethodType(call, self.mediator))

        with patch.object(self.logger, "info") as mock:
            try:
                self.mediator.call()
            except Exception:
                pass

        assert faux(mock).kwarg_equals("extra.at", "exception")
        assert faux(mock).kwargs_contain("extra.elapsed")

    def test_automatic_transaction(self):
        class TransactionMediator(Mediator):
            def call(self):
                User.objects.create(username="beep")
                raise Exception

        with self.assertRaises(Exception):
            TransactionMediator.run()

        assert not User.objects.filter(username="beep").exists()

    @patch.object(MockMediator, "post_commit")
    def test_post_commit(self, mock_post_commit):
        mediator = MockMediator(user={"name": "Example"}, age=30)
        mediator.run(user={"name": "Example"}, age=30)
        mock_post_commit.assert_called_once_with()
