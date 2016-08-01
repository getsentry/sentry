
"""Utilities for writing code that runs on Python 2 and 3"""
# flake8: noqa

# Copyright (c) 2010-2013 Benjamin Peterson
#
# Permission is hereby granted, free of charge, to any person obtaining a copy of
# this software and associated documentation files (the "Software"), to deal in
# the Software without restriction, including without limitation the rights to
# use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
# the Software, and to permit persons to whom the Software is furnished to do so,
# subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
# FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
# COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
# IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
# CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
from __future__ import absolute_import

try:
    import cPickle as pickle
except ImportError:
    import pickle  # NOQA

try:
    import urlparse as _urlparse
except ImportError:
    from urllib import parse as _urlparse  # NOQA

try:
    import ipaddress
except ImportError:
    import ipaddr as ipaddress

urlparse = _urlparse

try:
    from html import escape as html_escape
except ImportError:
    from cgi import escape as _escape

    def html_escape(value):
        return _escape(value, True)
