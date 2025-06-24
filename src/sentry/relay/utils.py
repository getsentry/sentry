import uuid


def get_header_relay_id(request):
    try:
        return str(uuid.UUID(request.META["HTTP_X_SENTRY_RELAY_ID"]))
    except (LookupError, ValueError, TypeError):
        pass


def get_header_relay_signature(request):
    try:
        return str(request.META["HTTP_X_SENTRY_RELAY_SIGNATURE"])
    except (LookupError, ValueError, TypeError):
        pass


def type_to_class_name(snake_str):
    components = snake_str.split("_")
    return "".join(x.title() for x in components[0:])


def to_camel_case_name(name):
    """
    Converts a string from snake_case to camelCase

    :param name: the string to convert
    :return: the name converted to camelCase

    >>> to_camel_case_name(22)
    22
    >>> to_camel_case_name("hello_world")
    'helloWorld'
    >>> to_camel_case_name("_hello_world")
    'helloWorld'
    >>> to_camel_case_name("__hello___world___")
    'helloWorld'
    >>> to_camel_case_name("hello")
    'hello'
    >>> to_camel_case_name("Hello_world")
    'helloWorld'
    >>> to_camel_case_name("one_two_three_four")
    'oneTwoThreeFour'
    >>> to_camel_case_name("oneTwoThreeFour")
    'oneTwoThreeFour'
    """

    def first_lower(s):
        return s[:1].lower() + s[1:]

    def first_upper(s):
        return s[:1].upper() + s[1:]

    if not isinstance(name, str):
        return name
    else:
        name = name.strip("_")
        pieces = name.split("_")
        return first_lower(pieces[0]) + "".join(first_upper(x) for x in pieces[1:])
