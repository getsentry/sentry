import ast

from tools.flake8_plugin import S001, S002, SentryCheck


def _run(src):
    tree = ast.parse(src)
    return list(SentryCheck(tree=tree).run())


def _errors(*errors):
    return [SentryCheck.adapt_error(e) for e in errors]


def test_S001():
    S001_py = """\
class A:
    def called_once():
        pass


A().called_once()
"""

    errors = _run(S001_py)
    assert errors == _errors(S001(6, 0, vars=("called_once",)))


def test_S002():
    S002_py = """\
print("print statements are not allowed")
"""

    errors = _run(S002_py)
    assert errors == _errors(S002(1, 0))


def test_S003():
    S003_py = """\
import json
import simplejson
from json import loads, load
from simplejson import JSONDecoder, JSONDecodeError, _default_encoder
import sentry.utils.json as good_json
from sentry.utils.json import JSONDecoder, JSONDecodeError


def bad_code():
    a = json.loads("''")
    b = simplejson.loads("''")
    c = loads("''")
    d = load()
"""

    errors = _run(S003_py)
    assert errors == [
        (
            1,
            0,
            "S003: Use ``from sentry.utils import json`` instead.",
            SentryCheck,
        ),
        (
            2,
            0,
            "S003: Use ``from sentry.utils import json`` instead.",
            SentryCheck,
        ),
        (
            3,
            0,
            "S003: Use ``from sentry.utils import json`` instead.",
            SentryCheck,
        ),
        (
            4,
            0,
            "S003: Use ``from sentry.utils import json`` instead.",
            SentryCheck,
        ),
    ]
