__all__ = ("Geo",)

from sentry.interfaces.base import Interface


class Geo(Interface):
    """
    The (approximate) geographical location of the end user.

    >>> {
    >>>     'country_code': 'US',
    >>>     'city': 'San Francisco',
    >>>     'region': 'CA',
    >>> }
    """

    @classmethod
    def to_python(cls, data):
        data = {
            "country_code": data.get("country_code"),
            "city": data.get("city"),
            "region": data.get("region"),
        }

        return cls(**data)
