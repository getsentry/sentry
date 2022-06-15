import ast

from tools.flake8_plugin import SentryCheck


def _run(src):
    tree = ast.parse(src)
    return sorted("t.py:{}:{}: {}".format(*error) for error in SentryCheck(tree=tree).run())


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
