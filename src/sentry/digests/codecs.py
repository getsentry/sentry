from __future__ import absolute_import

import zlib

from sentry.utils.compat import pickle


class Codec(object):
    def encode(self, value):
        raise NotImplementedError

    def decode(self, value):
        raise NotImplementedError


class CompressedPickleCodec(Codec):
    def encode(self, value):
        return zlib.compress(pickle.dumps(value))

    def decode(self, value):
        return pickle.loads(zlib.decompress(value))
