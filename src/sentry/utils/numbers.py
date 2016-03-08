BASE36_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'


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
        rv.append('-')
    rv.reverse()

    return ''.join(rv)


def _decode(number, alphabet):
    rv = 0
    inverse = False

    if number[:1] == '-':
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
    number = number.upper() \
        .replace('O', '0') \
        .replace('I', '1') \
        .replace('L', '1')
    return _decode(number, BASE32_ALPHABET)


def base36_encode(number):
    return _encode(number, BASE36_ALPHABET)


def base36_decode(str):
    return int(str, 36)
