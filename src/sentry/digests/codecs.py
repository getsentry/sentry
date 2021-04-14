import pickle
import zlib


class Codec:
    def encode(self, value):
        raise NotImplementedError

    def decode(self, value):
        raise NotImplementedError


class CompressedPickleCodec(Codec):
    def encode(self, value):
        return zlib.compress(pickle.dumps(value))

    def decode(self, value):
        return pickle.loads(zlib.decompress(value))
