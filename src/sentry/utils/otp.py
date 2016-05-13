from __future__ import absolute_import

import time
import hmac
import random
import base64
import qrcode
import urllib
import hashlib
from datetime import datetime
from itertools import izip

from sentry.utils.dates import to_timestamp


_builtin_constant_time_compare = getattr(hmac, 'compare_digest', None)


def constant_time_compare(val1, val2):
    if isinstance(val1, unicode):
        val1 = val1.encode('utf-8')
    if isinstance(val2, unicode):
        val2 = val2.encode('utf-8')
    if _builtin_constant_time_compare is not None:
        return _builtin_constant_time_compare(val1, val2)
    len_eq = len(val1) == len(val2)
    if len_eq:
        result = 0
        left = val1
    else:
        result = 1
        left = val2
    for x, y in izip(bytearray(left), bytearray(val2)):
        result |= x ^ y
    return result == 0


def generate_secret_key(length=32):
    return ''.join(random.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567')
                   for _ in range(length))


def _pack_int(i):
    result = bytearray()
    while i != 0:
        result.append(i & 0xFF)
        i >>= 8
    return bytes(bytearray(reversed(result)).rjust(8, b'\0'))


def _get_ts(ts):
    if ts is None:
        return int(time.time())
    if isinstance(ts, datetime):
        return int(to_timestamp(ts))
    return int(ts)


class _OTPQR(object):

    def __init__(self, qr):
        self._qr = qr
        self._matrix = qr.get_matrix()

    def __iter__(self):
        return iter(self._matrix)

    def __getitem__(self, item):
        if isinstance(item, tuple):
            x, y = item
            return self._matrix[y][x]
        return self._matrix[item]

    def as_html_table(self, class_='qrcode'):
        rows = []
        for row in self:
            rows.append('<tr>%s</tr>' % ''.join(
                '<td class="%s"></td>' % (x and 'filled' or 'empty')
                for x in row))
        return '<table class="%s">%s</table>' % (
            class_,
            '\n'.join(rows),
        )


class TOTP(object):

    def __init__(self, secret=None, digits=6, interval=30):
        if secret is None:
            secret = generate_secret_key()
        if len(secret) % 8 != 0:
            raise RuntimeError('Secret length needs to be a multiple of 8')
        self.secret = secret
        self.digits = digits
        self.interval = interval

    def generate_otp(self, ts=None, offset=0):
        ts = _get_ts(ts)
        counter = int(ts) // self.interval + offset
        h = bytearray(hmac.HMAC(
            base64.b32decode(self.secret.encode('ascii'), casefold=True),
            _pack_int(counter),
            hashlib.sha1,
        ).digest())
        offset = h[-1] & 0xf
        code = ((h[offset] & 0x7f) << 24 | (h[offset + 1] & 0xff) << 16 |
                (h[offset + 2] & 0xff) << 8 | (h[offset + 3] & 0xff))
        str_code = str(code % 10 ** self.digits)
        return ('0' * (self.digits - len(str_code))) + str_code

    def verify(self, otp, ts=None, window=2):
        ts = _get_ts(ts)
        for i in xrange(-window, window + 1):
            if constant_time_compare(otp, self.generate_otp(ts, i)):
                return True
        return False

    def get_provision_url(self, user, issuer=None):
        if issuer is None:
            issuer = 'Sentry'
        rv = 'otpauth://totp/%s?issuer=%s&secret=%s' % (
            urllib.quote(user.encode('utf-8')),
            urllib.quote(issuer.encode('utf-8')),
            self.secret
        )
        if self.digits != 6:
            rv += '&digits=%d' % self.digits
        if self.interval != 30:
            rv += '&period=%d' % self.interval
        return rv

    def get_provision_qrcode(self, user, issuer=None):
        qr = qrcode.QRCode()
        qr.make(self.get_provision_url(user, issuer=issuer))
        return _OTPQR(qr)
