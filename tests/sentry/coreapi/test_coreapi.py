# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry.interfaces.base import get_interface


def test_get_interface_does_not_let_through_disallowed_name():
    with pytest.raises(ValueError):
        get_interface("subprocess")


def test_get_interface_allows_http():
    from sentry.interfaces.http import Http

    result = get_interface("request")
    assert result is Http
    result = get_interface("request")
    assert result is Http
