from __future__ import absolute_import

import io
import logging
import six
import zlib

try:
    import uwsgi

    has_uwsgi = True
except ImportError:
    has_uwsgi = False

from django.conf import settings

logger = logging.getLogger(__name__)
Z_CHUNK = 1024 * 8


if has_uwsgi:

    class UWsgiChunkedInput(io.RawIOBase):
        def __init__(self):
            self._internal_buffer = b""

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


class ZDecoder(io.RawIOBase):
    """
    Base class for HTTP content decoders based on zlib
    See: https://github.com/eBay/wextracto/blob/9c789b1c98d95a1e87dbedfd1541a8688d128f5c/wex/http_decoder.py
    """

    def __init__(self, fp, z=None):
        self.fp = fp
        self.z = z
        self.flushed = None

    def readable(self):
        return True

    def readinto(self, buf):
        if self.z is None:
            self.z = zlib.decompressobj()
            retry = True
        else:
            retry = False

        n = 0
        max_length = len(buf)

        while max_length > 0:
            if self.flushed is None:
                chunk = self.fp.read(Z_CHUNK)
                compressed = self.z.unconsumed_tail + chunk
                try:
                    decompressed = self.z.decompress(compressed, max_length)
                except zlib.error:
                    if not retry:
                        raise
                    self.z = zlib.decompressobj(-zlib.MAX_WBITS)
                    retry = False
                    decompressed = self.z.decompress(compressed, max_length)

                if not chunk:
                    self.flushed = self.z.flush()
            else:
                if not self.flushed:
                    return n

                decompressed = self.flushed[:max_length]
                self.flushed = self.flushed[max_length:]

            buf[n : n + len(decompressed)] = decompressed
            n += len(decompressed)
            max_length = len(buf) - n

        return n


class DeflateDecoder(ZDecoder):
    """
    Decoding for "content-encoding: deflate"
    """


class GzipDecoder(ZDecoder):
    """
    Decoding for "content-encoding: gzip"
    """

    def __init__(self, fp):
        ZDecoder.__init__(self, fp, zlib.decompressobj(16 + zlib.MAX_WBITS))


class SetRemoteAddrFromForwardedFor(object):
    def __init__(self):
        if not getattr(settings, "SENTRY_USE_X_FORWARDED_FOR", True):
            from django.core.exceptions import MiddlewareNotUsed

            raise MiddlewareNotUsed

    def _remove_port_number(self, ip_address):
        if "[" in ip_address and "]" in ip_address:
            # IPv6 address with brackets, possibly with a port number
            return ip_address[ip_address.find("[") + 1 : ip_address.find("]")]
        if "." in ip_address and ip_address.rfind(":") > ip_address.rfind("."):
            # IPv4 address with port number
            # the last condition excludes IPv4-mapped IPv6 addresses
            return ip_address.rsplit(":", 1)[0]
        return ip_address

    def process_request(self, request):
        try:
            real_ip = request.META["HTTP_X_FORWARDED_FOR"]
        except KeyError:
            pass
        else:
            # HTTP_X_FORWARDED_FOR can be a comma-separated list of IPs.
            # Take just the first one.
            real_ip = real_ip.split(",")[0].strip()
            real_ip = self._remove_port_number(real_ip)
            request.META["REMOTE_ADDR"] = real_ip


class ChunkedMiddleware(object):
    def __init__(self):
        if not has_uwsgi:
            from django.core.exceptions import MiddlewareNotUsed

            raise MiddlewareNotUsed

    def process_request(self, request):
        # If we are dealing with chunked data and we have uwsgi we assume
        # that we can read to the end of the input stream so we can bypass
        # the default limited stream.  We set the content length reasonably
        # high so that the reads generally succeed.  This is ugly but with
        # Django 1.6 it seems to be the best we can easily do.
        if "HTTP_TRANSFER_ENCODING" not in request.META:
            return

        if request.META["HTTP_TRANSFER_ENCODING"].lower() == "chunked":
            request._stream = io.BufferedReader(UWsgiChunkedInput())
            request.META["CONTENT_LENGTH"] = "4294967295"  # 0xffffffff


class DecompressBodyMiddleware(object):
    def process_request(self, request):
        decode = False
        encoding = request.META.get("HTTP_CONTENT_ENCODING", "").lower()

        if encoding == "gzip":
            request._stream = GzipDecoder(request._stream)
            decode = True

        if encoding == "deflate":
            request._stream = DeflateDecoder(request._stream)
            decode = True

        if decode:
            # Since we don't know the original content length ahead of time, we
            # need to set the content length reasonably high so read generally
            # succeeds. This seems to be the only easy way for Django 1.6.
            request.META["CONTENT_LENGTH"] = "4294967295"  # 0xffffffff

            # The original content encoding is no longer valid, so we have to
            # remove the header. Otherwise, LazyData will attempt to re-decode
            # the body.
            del request.META["HTTP_CONTENT_ENCODING"]


class ContentLengthHeaderMiddleware(object):
    """
    Ensure that we have a proper Content-Length/Transfer-Encoding header
    """

    def process_response(self, request, response):
        if "Transfer-Encoding" in response or "Content-Length" in response:
            return response

        if not response.streaming:
            response["Content-Length"] = six.text_type(len(response.content))

        return response
