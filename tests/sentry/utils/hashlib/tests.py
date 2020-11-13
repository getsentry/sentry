# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest
import six

from sentry.utils.hashlib import md5_text, sha1_text, hash_values
from unittest import TestCase


HASHLIB_VALUES_TESTS = (
    ("seed", None, "75a0ad233bd9a091d9d26bacbe2f377e"),
    ("seed", True, "1057fb936dc9056388c0b9b48dd0c7df"),
    ("seed", False, "07aae33053c0f3487882d61353780682"),
    ("seed", 42, "d1ce9a19d659ae70a6b76ef6029ae542"),
    ("seed", six.binary_type("test".encode("utf-8")), "334e3fd2f66966a5c785d825c5f03494"),
    ("seed", six.text_type("test"), "ce35c0ce0d38976f61a5ca951de74a16"),
    ("seed", (4, 2), "d03b32e798444249d726158594d370f6"),
    ("seed", {six.text_type("test"): 42}, "ca094da15d323155e3954cff7ca373c4"),
    # XXX: It should be noted these cases EXPLICLTY exclude the fact that
    # python2 and python3 CANNOT hash to the same values whne using the `str`
    # and not the text_type, since they will map to different cases (py2 will
    # encode with the 0x06 'byte' marker and py3 will encode using the 0x07
    # 'unicode' marker).
)


@pytest.mark.parametrize("seed,value,hash", HASHLIB_VALUES_TESTS)
def test_hash_values(seed, value, hash):
    assert hash_values([value], seed=seed) == hash


def test_hashvalues_python23_strings():
    if six.PY2:
        assert hash_values(["test"], seed="seed") == "334e3fd2f66966a5c785d825c5f03494"
    else:
        assert hash_values(["test"], seed="seed") == "ce35c0ce0d38976f61a5ca951de74a16"


class HashlibTest(TestCase):
    def test_simple(self):
        md5_text("x").hexdigest() == "9dd4e461268c8034f5c8564e155c67a6"
        sha1_text("x").hexdigest() == "11f6ad8ec52a2984abaafd7c3b516503785c2072"

    def test_unicode(self):
        md5_text(u"ü").hexdigest() == "c03410a5204b21cd8229ff754688d743"
        sha1_text(u"ü").hexdigest() == "94a759fd37735430753c7b6b80684306d80ea16e"
