import random
import time

_ZERO_BIT = 1
_VERSION_BITS = 3
_TS_BITS = 32
_RANDOM_BITS = 28
_TOTAL_BITS = _ZERO_BIT + _VERSION_BITS + _TS_BITS + _RANDOM_BITS
assert _TOTAL_BITS == 64

_VERSION = 1

# 1st January 2022
_EPOCH_START = 1641024000


def reverse_bits(number: int, bit_size: int) -> int:
    return int(bin(number)[2:].zfill(bit_size)[::-1], 2)


# we will have room b/n version and time since for a while
# so let's reverse the version bits to grow to the right
# instead of left should we need more than 3 bits for version

_VERSION_PREFIX = reverse_bits(_VERSION, _VERSION_BITS)


def get_id() -> int:
    """
    Generates IDs for use by indexer storages that do not have autoincrement sequences (e.g. CloudSpanner).

    This function does not provide any guarantee of uniqueness, just a low probability of collisions.
    It relies on the database to be strongly consistent and reject writes with duplicate IDs. These should
    be retried with a newly generated ID.

    The ID generated is in roughly incrementing order.

    Metric IDs are 64 bit but this function only generates IDs that fit in 63 bits. The leading bit is always zero.
    This is because they were stored in Postgres as BigInt (signed 64 bit) and we do not want to change that now.
    In ClickHouse it is an unsigned 64 bit integer.
    """

    now = int(time.time())
    time_since_epoch = now - _EPOCH_START
    rand = random.getrandbits(_RANDOM_BITS)

    id = _VERSION_PREFIX << (_TOTAL_BITS - _ZERO_BIT - _VERSION_BITS)
    id |= time_since_epoch << (_TOTAL_BITS - _ZERO_BIT - _VERSION_BITS - _TS_BITS)
    id |= rand

    return id
