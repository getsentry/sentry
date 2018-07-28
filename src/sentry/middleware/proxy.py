from __future__ import absolute_import

import io
import six
try:
    import uwsgi
    has_uwsgi = True
except ImportError:
    has_uwsgi = False

from django.conf import settings


if has_uwsgi:
    class UWsgiChunkedInput(io.RawIOBase):
        def __init__(self):
            self._internal_buffer = b''

        def readable(self):
            return True

        def readinto(self, buf):
            if not self._internal_buffer:
                self._internal_buffer = uwsgi.chunked_read()

            n = min(len(buf), len(self._internal_buffer))
            if n > 0:
                buf[:n] = self._internal_buffer[:n]
                self._internal_buffer = self._internal_buffer[n:]

            return n


class SetRemoteAddrFromForwardedFor(object):
    def __init__(self):
        if not getattr(settings, 'SENTRY_USE_X_FORWARDED_FOR', True):
            from django.core.exceptions import MiddlewareNotUsed
            raise MiddlewareNotUsed

    def process_request(self, request):
        try:
            real_ip = request.META['HTTP_X_FORWARDED_FOR']
        except KeyError:
            pass
        else:
            # HTTP_X_FORWARDED_FOR can be a comma-separated list of IPs.
            # Take just the first one.
            real_ip = real_ip.split(",")[0].strip()
            if ':' in real_ip and '.' in real_ip:
                # Strip the port number off of an IPv4 FORWARDED_FOR entry.
                real_ip = real_ip.split(':', 1)[0]
            request.META['REMOTE_ADDR'] = real_ip


class ChunkedMiddleware(object):
    def __init__(self):
        if not has_uwsgi:
            from django.core.exceptions import MiddlewareNotUsed
            raise MiddlewareNotUsed

    def process_request(self, request):
        # If we are dealing with chunked data and we have uwsgi we assume
        # that we can read to the end of the input stream so we can bypass
        # the default limited stream.  We set the content length reasonably
        # high so that the reads generally succeeed.  This is ugly but with
        # Django 1.6 it seems to be the best we can easily do.
        if 'HTTP_TRANSFER_ENCODING' not in request.META:
            return

        if request.META['HTTP_TRANSFER_ENCODING'].lower() == 'chunked':
            request._stream = io.BufferedReader(UWsgiChunkedInput())
            request.META['CONTENT_LENGTH'] = '4294967295'  # 0xffffffff


class ContentLengthHeaderMiddleware(object):
    """
    Ensure that we have a proper Content-Length/Transfer-Encoding header
    """

    def process_response(self, request, response):
        if 'Transfer-Encoding' in response or 'Content-Length' in response:
            return response

        if not response.streaming:
            response['Content-Length'] = six.text_type(len(response.content))

        return response
