import string

from django.utils.crypto import get_random_string


def get_secure_token() -> str:
    return get_random_string(32, string.ascii_letters + string.digits)
