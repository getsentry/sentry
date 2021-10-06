from sentry.utils.strings import is_valid_dot_atom


class ListResolver:
    """
    Manages the generation of RFC 2919 compliant list-id strings from varying
    objects types.
    """

    class UnregisteredTypeError(Exception):
        """
        Error raised when attempting to build a list-id from an unregistered object type.
        """

    def __init__(self, namespace, type_handlers):
        assert is_valid_dot_atom(namespace)

        # The list-id-namespace that will be used when generating the list-id
        # string. This should be a domain name under the control of the
        # generator (see RFC 2919.)
        self.__namespace = namespace

        # A mapping of classes to functions that accept an instance of that
        # class, returning a tuple of values that will be used to generate the
        # list label. Returned values must be valid RFC 2822 dot-atom-text
        # values.
        self.__type_handlers = type_handlers

    def __call__(self, instance):
        """
        Build a list-id string from an instance.

        Raises ``UnregisteredTypeError`` if there is no registered handler for
        the instance type. Raises ``AssertionError`` if a valid list-id string
        cannot be generated from the values returned by the type handler.
        """
        try:
            handler = self.__type_handlers[type(instance)]
        except KeyError:
            raise self.UnregisteredTypeError(
                f"Cannot generate mailing list identifier for {instance!r}"
            )

        label = ".".join(map(str, handler(instance)))
        assert is_valid_dot_atom(label)

        return f"<{label}.{self.__namespace}>"
