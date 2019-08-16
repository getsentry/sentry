"""
Copyright (c) 2015 Sentry Team
Copyright (c) 2009 Mark Nottingham

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
"""

from __future__ import absolute_import

__all__ = ("parse_link_header",)

import re

TOKEN = r'(?:[^\(\)<>@,;:\\"/\[\]\?={} \t]+?)'
QUOTED_STRING = r'(?:"(?:\\"|[^"])*")'
PARAMETER = r"(?:%(TOKEN)s(?:=(?:%(TOKEN)s|%(QUOTED_STRING)s))?)" % locals()
LINK = r"<[^>]*>\s*(?:;\s*%(PARAMETER)s?\s*)*" % locals()
COMMA = r"(?:\s*(?:,\s*)+)"
LINK_SPLIT = r"%s(?=%s|\s*$)" % (LINK, COMMA)

link_splitter = re.compile(LINK_SPLIT)


def _unquotestring(instr):
    if instr[0] == instr[-1] == '"':
        instr = instr[1:-1]
        instr = re.sub(r"\\(.)", r"\1", instr)
    return instr


def _splitstring(instr, item, split):
    if not instr:
        return []
    return [h.strip() for h in re.findall(r"%s(?=%s|\s*$)" % (item, split), instr)]


def parse_link_header(instr):
    """
    Given a link-value (i.e., after separating the header-value on commas),
    return a dictionary whose keys are link URLs and values are dictionaries
    of the parameters for their associated links.

    Note that internationalised parameters (e.g., title*) are
    NOT percent-decoded.

    Also, only the last instance of a given parameter will be included.

    For example,

    >>> parse_link_value('</foo>; rel="self"; title*=utf-8\'de\'letztes%20Kapitel')
    {'/foo': {'title*': "utf-8'de'letztes%20Kapitel", 'rel': 'self'}}

    """
    out = {}
    if not instr:
        return out

    for link in [h.strip() for h in link_splitter.findall(instr)]:
        url, params = link.split(">", 1)
        url = url[1:]
        param_dict = {}
        for param in _splitstring(params, PARAMETER, "\s*;\s*"):
            try:
                a, v = param.split("=", 1)
                param_dict[a.lower()] = _unquotestring(v)
            except ValueError:
                param_dict[param.lower()] = None
        out[url] = param_dict
    return out
