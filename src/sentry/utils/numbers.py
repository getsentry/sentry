ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'


def base36_encode(number):
    if number == 0:
        return '0'

    rv = []
    inverse = False
    if number < 0:
        number = -number
        inverse = True

    while number != 0:
        number, i = divmod(number, 36)
        rv.append(ALPHABET[i])

    if inverse:
        rv.append('-')
    rv.reverse()

    return ''.join(rv)


def base36_decode(str):
    return int(str, 36)
