from __future__ import absolute_import, print_function

import base64


def urlsafe_b64decode(b64string):
    padded = b64string + b'=' * (4 - len(b64string) % 4)
    return base64.urlsafe_b64decode(padded)
