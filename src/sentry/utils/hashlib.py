from __future__ import absolute_import

import six
from hashlib import md5 as _md5
from hashlib import sha1 as _sha1

from django.utils.encoding import force_bytes


def md5_text(*args):
    m = _md5()
    for x in args:
        m.update(force_bytes(x, errors="replace"))
    return m


def sha1_text(*args):
    m = _sha1()
    for x in args:
        m.update(force_bytes(x, errors="replace"))
    return m


def hash_value(h, value):
    if value is None:
        h.update(b"\x00")
    elif value is True:
        h.update(b"\x01")
    elif value is False:
        h.update(b"\x02")
    elif isinstance(value, six.integer_types):
        h.update(b"\x03" + six.text_type(value).encode("ascii") + b"\x00")
    elif isinstance(value, (tuple, list)):
        h.update(b"\x04" + six.text_type(len(value)).encode("utf-8"))
        for item in value:
            hash_value(h, item)
    elif isinstance(value, dict):
        h.update(b"\x05" + six.text_type(len(value)).encode("utf-8"))
        for k, v in six.iteritems(value):
            hash_value(h, k)
            hash_value(h, v)
    elif isinstance(value, bytes):
        h.update(b"\x06" + value + b"\x00")
    elif isinstance(value, six.text_type):
        h.update(b"\x07" + value.encode("utf-8") + b"\x00")
    else:
        raise TypeError("Invalid hash value")


def hash_values(values, seed=None, algorithm=_md5):
    h = _md5()
    if seed is not None:
        h.update((u"%s\xff" % seed).encode("utf-8"))
    for value in values:
        hash_value(h, value)
    return h.hexdigest()
