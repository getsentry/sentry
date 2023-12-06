import pytest

from sentry.mediators.param import Param
from sentry.models.user import User
from sentry.testutils.cases import TestCase


class TestParam(TestCase):
    def test_validate_type(self):
        name = Param(str)

        with pytest.raises(TypeError):
            name.validate(None, "name", 1)

    def test_validate_required(self):
        name = Param(str)

        with pytest.raises(AttributeError):
            name.validate(None, "name", None)

    def test_validate_default_type(self):
        name = Param(str, default=1)  # type: ignore[arg-type]

        with pytest.raises(TypeError):
            name.validate(None, "name", None)

    def test_validate_user_defined_type(self):
        user = Param(User)
        assert user.validate(None, "user", User())

    def test_setup(self):
        class Target:
            name = 1

        name = Param(str)
        name.setup(Target, "name")

        assert not hasattr(Target, "name")
        assert hasattr(Target, "_name")
        assert Target._name == name

    def test_default(self):
        name = Param(str, default="Pete")
        assert name.default(None) == "Pete"

    def test_lambda_default(self):
        _name = "Steve"
        name = Param(str, default=lambda self: _name)
        assert name.default(None) == "Steve"

    def test_default_referencing_instance(self):
        class Target:
            user = {"name": "Pete"}

        target = Target()
        name = Param(str, default=lambda self: self.user["name"])
        assert name.default(target) == "Pete"
