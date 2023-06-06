import logging
import types
from unittest.mock import PropertyMock, patch

import pytest

from sentry.mediators import Mediator, Param
from sentry.models import User
from sentry.testutils import TestCase
from sentry.testutils.helpers.faux import faux
from sentry.testutils.silo import control_silo_test


class Double:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


class MockMediator(Mediator):
    user = Param(dict)
    name = Param((str,), default=lambda self: self.user["name"])
    age = Param(int, required=False)

    def call(self):
        with self.log():
            pass


@control_silo_test(stable=True)
class TestMediator(TestCase):
    def setUp(self):
        super(TestCase, self).setUp()

        self.logger = logging.getLogger("test-mediator")
        self.mediator = MockMediator(user={"name": "Example"}, age=30, logger=self.logger)

    def test_must_implement_call(self):
        with patch.object(MockMediator, "call"):
            del MockMediator.call

            with pytest.raises(NotImplementedError):
                MockMediator.run(user={"name": "Example"})

    def test_validate_params(self):
        with pytest.raises(TypeError):
            MockMediator.run(user=False)

    def test_param_access(self):
        assert self.mediator.user == {"name": "Example"}
        assert self.mediator.age == 30

    def test_param_default_access(self):
        assert self.mediator.name == "Example"

    def test_missing_params(self):
        with pytest.raises(AttributeError):
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
                raise RuntimeError()

        with pytest.raises(RuntimeError):
            TransactionMediator.run()

        assert not User.objects.filter(username="beep").exists()

    @patch.object(MockMediator, "post_commit")
    @patch.object(MockMediator, "call")
    def test_post_commit(self, mock_call, mock_post_commit):
        mediator = MockMediator(user={"name": "Example"}, age=30)
        mediator.run(user={"name": "Example"}, age=30)
        mock_post_commit.assert_called_once_with()
        mock_call.assert_called_once_with()
