import ast

from tools.flake8_plugin import SentryCheck


def _run(src):
    tree = ast.parse(src)
    return sorted(
        "t.py:{}:{}: {}".format(*error)
        for error in SentryCheck(tree=tree, filename="getsentry/foo.py").run()
    )


def test_S001():
    S001_py = """\
class A:
    def called_once():
        pass


A().called_once()
"""

    errors = _run(S001_py)
    assert errors == [
        "t.py:6:0: S001 Avoid using the called_once mock call as it is confusing and "
        "prone to causing invalid test behavior.",
    ]


def test_S002():
    S002_py = """\
print("print statements are not allowed")
"""

    errors = _run(S002_py)
    assert errors == ["t.py:1:0: S002 print functions or statements are not allowed."]


def test_S003():
    S003_py = """\
import json
import simplejson
from json import loads, load
from simplejson import JSONDecoder, JSONDecodeError, _default_encoder
import sentry.utils.json as good_json
from sentry.utils.json import JSONDecoder, JSONDecodeError
from .json import Validator


def bad_code():
    a = json.loads("''")
    b = simplejson.loads("''")
    c = loads("''")
    d = load()
"""

    errors = _run(S003_py)
    assert errors == [
        "t.py:1:0: S003 Use ``from sentry.utils import json`` instead.",
        "t.py:2:0: S003 Use ``from sentry.utils import json`` instead.",
        "t.py:3:0: S003 Use ``from sentry.utils import json`` instead.",
        "t.py:4:0: S003 Use ``from sentry.utils import json`` instead.",
    ]


def test_S004():
    S004_py = """\
import unittest
from something import func


class Test(unittest.TestCase):
    def test(self):
        with self.assertRaises(ValueError):
            func()
"""
    errors = _run(S004_py)
    assert errors == [
        "t.py:7:13: S004 Use `pytest.raises` instead for better debuggability.",
    ]


def test_S005():
    S005_py = """\
from sentry.models import User
"""
    errors = _run(S005_py)
    assert errors == [
        "t.py:1:0: S005 Do not import models from sentry.models but the actual module",
    ]
