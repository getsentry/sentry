from __future__ import absolute_import

BASE36_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
BASE32_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def _encode(number, alphabet):
    if number == 0:
        return alphabet[0]

    base = len(alphabet)
    rv = []
    inverse = False
    if number < 0:
        number = -number
        inverse = True

    while number != 0:
        number, i = divmod(number, base)
        rv.append(alphabet[i])

    if inverse:
        rv.append("-")
    rv.reverse()

    return "".join(rv)


def _decode(number, alphabet):
    rv = 0
    inverse = False

    if number[:1] == "-":
        inverse = True
        number = number[:1]

    base = len(alphabet)
    for symbol in number:
        rv = rv * base + alphabet.index(symbol)

    if inverse:
        rv = rv * -1

    return rv


def base32_encode(number):
    return _encode(number, BASE32_ALPHABET)


def base32_decode(number):
    number = number.upper().replace("O", "0").replace("I", "1").replace("L", "1")
    return _decode(number, BASE32_ALPHABET)


def base36_encode(number):
    return _encode(number, BASE36_ALPHABET)


def base36_decode(s):
    return int(s, 36)


DEFAULT_UNITS = ("B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB")


def format_bytes(number, units=DEFAULT_UNITS, decimal_places=2):
    block = 1024.0
    if number < block:
        return "{} {}".format(number, units[0])

    u = 0
    max_unit = len(units) - 1
    while number >= block and u < max_unit:
        number /= block
        u += 1
    return (u"{:.%df} {}" % (decimal_places,)).format(number, units[u])
