import pytest
from sentry.logging.handlers import flatten_args


@pytest.mark.parametrize('args,out', (
    ({'a': 1, 'b': True, 'c': []}, {'args.a': 1, 'args.b': True, 'args.c': '[]'}),
    ([1, True, []], {'args.0': 1, 'args.1': True, 'args.2': '[]'}),
    ('foo', {'args.0': 'foo'}),
    (1, {'args.0': 1}),
    (True, {'args.0': True}),
    (None, {'args.0': None}),
    (Exception(), {'args.0': 'Exception()'}),
))
def test_flatten_args(args, out):
    assert flatten_args(args) == out
