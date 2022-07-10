from functools import wraps

import pytest
from django.test import utils


class TestContextDecorator:
    """
    Same as django's TestContextDecorator, but works on non-django classes
    """

    def __enter__(self):
        return self.enable()

    def __exit__(self, exc, ty, tb):
        self.disable()

    def roll_name(self):
        return f"apply_decorator_{self.__class__.__name__}"

    def __call__(slf, f):
        if isinstance(f, type):

            @pytest.fixture(autouse=True)
            def _applied_decorator(self):
                with slf:
                    yield

            setattr(f, slf.roll_name(), _applied_decorator)
            return f
        else:
            assert callable(f)

            @wraps(f)
            def inner(*args, **kwargs):
                with slf:
                    return f(*args, **kwargs)

            return inner


class override_settings(TestContextDecorator, utils.override_settings):
    pass
