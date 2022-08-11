import random
import time

_VERSION_BITS = 4
_TS_BITS = 32
_RANDOM_BITS = 28
_TOTAL_BITS = _VERSION_BITS + _TS_BITS + _RANDOM_BITS
assert _TOTAL_BITS == 64

_VERSION = 2

# 1st January 2022
_EPOCH_START = 1641024000


def reverse_bits(number: int, bit_size: int) -> int:
    return int(bin(number)[2:].zfill(bit_size)[::-1], 2)


# we will have room b/n version and time since for a while
# so let's reverse the version bits to grow to the right
# instead of left should we need more than 4bits for version
#
#  version             time since
# (0100    | 00000001001000101000000111100011)
#
# (10000)  |  0000001001000101000000111100011)

_VERSION_PREFIX = reverse_bits(_VERSION, _VERSION_BITS)


def get_id() -> int:
    """
    Generates IDs for use by indexer storages that do not have autoincrement sequences (e.g. CloudSpanner).
    This function does not provide any guarantee of uniqueness, just a low probability of collisions.
    It relies on the database to be strongly consistent and reject writes with duplicate IDs. These should
    be retried with a newly generated ID.

    The ID generated is in roughly incrementing order.
    """

    now = int(time.time())
    time_since_epoch = now - _EPOCH_START
    rand = random.getrandbits(_RANDOM_BITS)

    id = _VERSION_PREFIX << (_TOTAL_BITS - _VERSION_BITS)
    id |= time_since_epoch << (_TOTAL_BITS - _VERSION_BITS - _TS_BITS)
    id |= rand

    return id
