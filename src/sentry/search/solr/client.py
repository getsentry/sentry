# -*- coding: utf-8 -*-
"""
sentry.search.solr.client
~~~~~~~~~~~~~~~~~~~~~~~~~

A majority of the Solr client is heavily inspired by Pysolr:
https://github.com/toastdriven/pysolr

The main differences are we focus on Python 2, and we must remove the
dependency on the ``requests`` library.

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

import urllib3

try:
    # Prefer lxml, if installed.
    from lxml import etree as ET
except ImportError:
    try:
        from xml.etree import cElementTree as ET
    except ImportError:
        raise ImportError("No suitable ElementTree implementation was found.")

from urlparse import urljoin

from nydus.db.backends import BaseConnection

import six

# Using two-tuples to preserve order.
REPLACEMENTS = (
    # Nuke nasty control characters.
    ('\x00', ''),  # Start of heading
    ('\x01', ''),  # Start of heading
    ('\x02', ''),  # Start of text
    ('\x03', ''),  # End of text
    ('\x04', ''),  # End of transmission
    ('\x05', ''),  # Enquiry
    ('\x06', ''),  # Acknowledge
    ('\x07', ''),  # Ring terminal bell
    ('\x08', ''),  # Backspace
    ('\x0b', ''),  # Vertical tab
    ('\x0c', ''),  # Form feed
    ('\x0e', ''),  # Shift out
    ('\x0f', ''),  # Shift in
    ('\x10', ''),  # Data link escape
    ('\x11', ''),  # Device control 1
    ('\x12', ''),  # Device control 2
    ('\x13', ''),  # Device control 3
    ('\x14', ''),  # Device control 4
    ('\x15', ''),  # Negative acknowledge
    ('\x16', ''),  # Synchronous idle
    ('\x17', ''),  # End of transmission block
    ('\x18', ''),  # Cancel
    ('\x19', ''),  # End of medium
    ('\x1a', ''),  # Substitute character
    ('\x1b', ''),  # Escape
    ('\x1c', ''),  # File separator
    ('\x1d', ''),  # Group separator
    ('\x1e', ''),  # Record separator
    ('\x1f', ''),  # Unit separator
)


def sanitize(data):
    if isinstance(data, six.text_type):
        data = data.encode('utf-8')

    for bad, good in REPLACEMENTS:
        data = data.replace(bad, good)

    return data.decode('utf-8')


def is_valid_xml_char_ordinal(i):
    """
    Defines whether char is valid to use in xml document

    XML standard defines a valid char as::

    Char ::= #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]
    """
    return (
        # conditions ordered by presumed frequency
        0x20 <= i <= 0xD7FF
        or i in (0x9, 0xA, 0xD)
        or 0xE000 <= i <= 0xFFFD
        or 0x10000 <= i <= 0x10FFFF
    )


def clean_xml_string(s):
    """
    Cleans string from invalid xml chars

    Solution was found there::

    http://stackoverflow.com/questions/8733233/filtering-out-certain-bytes-in-python
    """
    return ''.join(c for c in s if is_valid_xml_char_ordinal(ord(c)))


class SolrError(Exception):
    pass


class SolrClient(object):
    """
    Inspired by Pysolr, but retrofitted to support a limited scope of features
    and remove the ``requests`` dependency.
    """
    def __init__(self, url, timeout=60):
        self.url = url
        self.timeout = timeout
        self.http = urllib3.connection_from_url(self.url)

    def _send_request(self, method, path='', body=None, headers=None):
        url = urljoin(self.url, path.lstrip('/'))
        method = method.lower()

        if headers is None:
            headers = {}

        if not any(key.lower() == 'content-type' for key in headers.iterkeys()):
            headers['Content-Type'] = 'application/xml; charset=UTF-8'

        if isinstance(body, six.text_type):
            body = body.encode('utf-8')

        resp = self.http.urlopen(
            method, url, body=body, headers=headers, timeout=self.timeout)

        if resp.status != 200:
            raise SolrError(self._extract_error(resp))

        return resp

    def _extract_error(self, response):
        if not response.headers.get('content-type', '').startswith('application/xml'):
            return six.text_type(response.status)

        dom_tree = ET.fromstring(response.data)
        reason_node = dom_tree.find('response/lst/str')
        if reason_node is None:
            return response.data
        return reason_node.text

    def _is_null_value(self, value):
        if value is None:
            return True

        if isinstance(value, six.string_types) and len(value) == 0:
            return True

        return False

    def _add_doc_field(self, doc, key, value):
        if not isinstance(value, dict):
            return self._add_doc_field(doc, key, {None: value})

        # dict is expected to be something like
        # {key: {'add': [value]}}
        for action, action_value in value.iteritems():
            # To avoid multiple code-paths we'd like to treat all of our values
            # as iterables:
            if isinstance(action_value, (list, tuple)):
                action_value = action_value
            else:
                action_value = (action_value, )

            for bit in action_value:
                if self._is_null_value(bit):
                    continue

                attrs = {
                    'name': key,
                }
                if action:
                    attrs['update'] = action
                field = ET.Element('field', **attrs)
                field.text = self._from_python(bit)
                doc.append(field)

    def _from_python(self, value):
        """
        Converts python values to a form suitable for insertion into the xml
        we send to solr.
        """
        if hasattr(value, 'strftime'):
            if hasattr(value, 'hour'):
                value = u"%sZ" % value.isoformat()
            else:
                value = u"%sT00:00:00Z" % value.isoformat()
        elif isinstance(value, bool):
            if value:
                value = u'true'
            else:
                value = u'false'
        else:
            if isinstance(value, str):
                value = six.text_type(value, errors='replace')

            value = u"{0}".format(value)

        return clean_xml_string(value)

    def _build_doc(self, doc):
        doc_elem = ET.Element('doc')

        for key, value in doc.items():
            self._add_doc_field(doc_elem, key, value)

        return doc_elem

    def _update(self, message, commit=None, waitFlush=None, waitSearcher=None,
                softCommit=None):
        """
        Posts the given xml message to http://<self.url>/update and
        returns the result.

        Passing `sanitize` as False will prevent the message from being cleaned
        of control characters (default True). This is done by default because
        these characters would cause Solr to fail to parse the XML. Only pass
        False if you're positive your data is clean.
        """
        path = '/update'

        # Per http://wiki.apache.org/solr/UpdateXmlMessages, we can append a
        # ``commit=true`` to the URL and have the commit happen without a
        # second request.
        query_vars = []

        if commit is not None:
            query_vars.append('commit=%s' % str(bool(commit)).lower())

        if waitFlush is not None:
            query_vars.append('waitFlush=%s' % str(bool(waitFlush)).lower())

        if waitSearcher is not None:
            query_vars.append('waitSearcher=%s' % str(bool(waitSearcher)).lower())

        if query_vars:
            path = '%s?%s' % (path, '&'.join(query_vars))

        # remove ctrl characters
        message = sanitize(message)

        return self._send_request('post', path, message, {
            'Content-type': 'text/xml; charset=utf-8'
        })

    def add(self, docs, commit=None, commitWithin=None, waitFlush=None,
            waitSearcher=None):
        """
        >>> solr.add([
        >>>     {
        >>>         "id": "doc_1",
        >>>         "title": "A test document",
        >>>     },
        >>>     {
        >>>         "id": "doc_2",
        >>>         "title": "The Banana: Tasty or Dangerous?",
        >>>         "tags": {
        >>>             "add": ["foo", "bar"],
        >>>         },
        >>>     },
        >>> ])
        """
        message = ET.Element('add')

        if commitWithin:
            message.set('commitWithin', commitWithin)

        for doc in docs:
            message.append(self._build_doc(doc))

        m = ET.tostring(message, encoding='utf-8')

        return self._update(m, commit=commit, waitFlush=waitFlush,
                            waitSearcher=waitSearcher)


class Solr(BaseConnection):
    retryable_exceptions = frozenset([urllib3.Timeout])

    def __init__(self, num, url, timeout=60):
        self.url = url
        self.timeout = timeout
        super(Solr, self).__init__(num)

    @property
    def identifier(self):
        return 'solr+%(url)s' % vars(self)

    def connect(self):
        return SolrClient(self.url, timeout=self.timeout)

    def disconnect(self):
        pass
