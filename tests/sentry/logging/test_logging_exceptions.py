import logging
from unittest.mock import Mock

import pytest
import structlog
from django.conf import settings
from django.test import override_settings

from sentry.logging.handlers import JSONRenderer, StructLogHandler
from sentry.testutils.cases import TestCase


class TestExceotionsDuringLogging(TestCase):
    """
    Test that exceptions during logging are handled gracefully in Production,
    while still being surfaced in non-Production environments.
    """

    def setUp(self):
        super().setUp()
        structlog.configure(processors=[JSONRenderer()])
        self.logger = logging.getLogger(__name__)
        self.logger.addHandler(StructLogHandler())
        self.logger.propagate = False
        self.foo = Mock()

    @override_settings(IS_PROD=False)
    def test_non_prod(self):
        logging.raiseExceptions = (
            not settings.IS_PROD
        )  # TODO: this is a hack, figure out how to test this properly e2e
        with pytest.raises(TypeError):
            self.logger.info("foo", extra={"foo": {self.foo: "foo"}})

    @override_settings(IS_PROD=True)
    def test_prod(self):
        logging.raiseExceptions = not settings.IS_PROD
        self.logger.info("foo", extra={"foo": {self.foo: "foo"}})
