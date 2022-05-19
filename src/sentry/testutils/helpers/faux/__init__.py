from sentry.testutils.helpers.faux.any import Any
from sentry.testutils.helpers.faux.dict_containing import DictContaining
from sentry.testutils.helpers.faux.faux import Faux
from sentry.testutils.helpers.faux.mock import Mock


def faux(mock, call=None):
    if call is not None:
        return Faux(mock.mock_calls[call])
    else:
        return Faux(mock.mock_calls[-1])


__all__ = (
    "Any",
    "DictContaining",
    "faux",
    "Faux",
    "Mock",
)
