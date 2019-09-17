from __future__ import absolute_import

import six

from sentry.mediators import Param
from sentry.models import User
from sentry.testutils import TestCase


class TestParam(TestCase):
    def test_validate_type(self):
        name = Param(six.string_types)

        with self.assertRaises(TypeError):
            name.validate(None, "name", 1)

    def test_validate_required(self):
        name = Param(six.string_types)

        with self.assertRaises(AttributeError):
            name.validate(None, "name", None)

    def test_validate_default_type(self):
        name = Param(six.string_types, default=1)

        with self.assertRaises(TypeError):
            name.validate(None, "name", None)

    def test_validate_user_defined_type(self):
        user = Param("sentry.models.User")
        assert user.validate(None, "user", User())

    def test_setup(self):
        class Target(object):
            name = 1

        name = Param(six.string_types)
        name.setup(Target, "name")

        assert not hasattr(Target, "name")
        assert hasattr(Target, "_name")
        assert Target._name == name

    def test_default(self):
        name = Param(six.string_types, default="Pete")
        assert name.default(None) == "Pete"

    def test_lambda_default(self):
        _name = "Steve"
        name = Param(six.string_types, default=lambda self: _name)
        assert name.default(None) == "Steve"

    def test_default_referencing_instance(self):
        class Target(object):
            user = {"name": "Pete"}

        target = Target()
        name = Param(six.string_types, default=lambda self: self.user["name"])
        assert name.default(target) == "Pete"
