import importlib.machinery
import importlib.util
from pathlib import Path

import pytest


@pytest.fixture
def dispatch_setup():
    path = Path(__file__).with_name("getsentry-dispatch-setup")
    loader = importlib.machinery.SourceFileLoader("getsentry_dispatch_setup", str(path))
    spec = importlib.util.spec_from_loader(loader.name, loader)
    assert spec is not None
    module = importlib.util.module_from_spec(spec)
    loader.exec_module(module)
    return module


def test_seer_bot_is_authorized_without_write_access(dispatch_setup) -> None:
    assert dispatch_setup._is_authorized("sentry[bot]", has_write=False)


def test_untrusted_user_still_requires_write_access(dispatch_setup) -> None:
    assert not dispatch_setup._is_authorized("external-user", has_write=False)
    assert dispatch_setup._is_authorized("external-user", has_write=True)
