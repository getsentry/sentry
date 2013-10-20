"""
sentry.search.solr.client
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

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


class SolrError(Exception):
    pass


class SolrClient(object):
    """
    Inspired by Pysolr, but retrofitted to support a limited scope of features
    and remove the ``requests`` dependency.

    See also:
    https://github.com/toastdriven/pysolr
    """
    def __init__(self, url, timeout=60):
        self.url = url
        self.timeout = timeout
        self.http = urllib3.connection_from_url(self.url)

    def _send_request(self, method, path='', body=None, headers=None):
        url = urljoin(self.url, path.lstrip('/'))
        method = method.lower()
        log_body = body

        if headers is None:
            headers = {}

        if log_body is None:
            log_body = ''
        elif not isinstance(log_body, str):
            log_body = repr(body)

        if not 'content-type' in [key.lower() for key in headers.keys()]:
            headers['Content-type'] = 'application/xml; charset=UTF-8'

        resp = self.http.urlopen(
            method, url, body=body, headers=headers, timeout=self.timeout)

        if resp.status != 200:
            raise SolrError(resp.data)

        return resp

    def _is_null_value(self, value):
        if value is None:
            return True

        if isinstance(value, basestring) and len(value) == 0:
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
                value = "%sZ" % value.isoformat()
            else:
                value = "%sT00:00:00Z" % value.isoformat()
        elif isinstance(value, bool):
            if value:
                value = 'true'
            else:
                value = 'false'
        else:
            if isinstance(value, str):
                value = unicode(value, errors='replace')

            value = "{0}".format(value)

        return value

    def _build_doc(self, doc):
        doc_elem = ET.Element('doc')

        for key, value in doc.items():
            self._add_doc_field(doc_elem, key, value)

        return doc_elem

    def _update(self, message, commit=True, waitFlush=None, waitSearcher=None,
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

        return self._send_request('post', path, message, {
            'Content-type': 'text/xml; charset=utf-8'
        })

    def add(self, docs, commit=True, commitWithin=None, waitFlush=None,
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
