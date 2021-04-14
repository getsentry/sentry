import base64
import hashlib
import hmac
import time
from datetime import datetime
from urllib.parse import quote

from django.utils.crypto import constant_time_compare, get_random_string

from sentry.utils.dates import to_timestamp


def generate_secret_key(length=32):
    return get_random_string(length, "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567")


def _pack_int(i):
    result = bytearray()
    while i != 0:
        result.append(i & 0xFF)
        i >>= 8
    return bytes(bytearray(reversed(result)).rjust(8, b"\0"))


def _get_ts(ts):
    if ts is None:
        return int(time.time())
    if isinstance(ts, datetime):
        return int(to_timestamp(ts))
    return int(ts)


class TOTP:
    def __init__(self, secret=None, digits=6, interval=30, default_window=2):
        if secret is None:
            secret = generate_secret_key()
        if len(secret) % 8 != 0:
            raise RuntimeError("Secret length needs to be a multiple of 8")
        self.secret = secret
        self.digits = digits
        self.interval = interval
        self.default_window = default_window

    def generate_otp(self, ts=None, offset=0, counter=None):
        if counter is None:
            ts = _get_ts(ts)
            counter = int(ts) // self.interval + offset
        h = bytearray(
            hmac.HMAC(
                base64.b32decode(self.secret.encode("ascii"), casefold=True),
                _pack_int(counter),
                hashlib.sha1,
            ).digest()
        )
        offset = h[-1] & 0xF
        code = (
            (h[offset] & 0x7F) << 24
            | (h[offset + 1] & 0xFF) << 16
            | (h[offset + 2] & 0xFF) << 8
            | (h[offset + 3] & 0xFF)
        )
        str_code = str(code % 10 ** self.digits)
        return ("0" * (self.digits - len(str_code))) + str_code

    def verify(self, otp, ts=None, window=None, return_counter=False, check_counter_func=None):
        ts = _get_ts(ts)
        if window is None:
            window = self.default_window
        for i in range(-window, window + 1):
            counter = int(ts) // self.interval + i
            if constant_time_compare(otp, self.generate_otp(counter=counter)):
                # Check for blacklisted counters after the constant time
                # compare
                if check_counter_func is not None and not check_counter_func(counter):
                    continue
                if return_counter:
                    return counter
                return True
        if return_counter:
            return None
        return False

    def get_provision_url(self, user, issuer=None):
        if issuer is None:
            issuer = "Sentry"
        rv = "otpauth://totp/{}?issuer={}&secret={}".format(
            quote(user.encode("utf-8")),
            quote(issuer.encode("utf-8")),
            self.secret,
        )
        if self.digits != 6:
            rv += "&digits=%d" % self.digits
        if self.interval != 30:
            rv += "&period=%d" % self.interval
        return rv
