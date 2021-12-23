__all__ = ("Sdk",)

from sentry.interfaces.base import Interface
from sentry.utils.json import prune_empty_keys


class Sdk(Interface):
    """
    The SDK used to transmit this event.

    >>> {
    >>>     "name": "sentry.java",
    >>>     "version": "1.7.10",
    >>>     "integrations": ["log4j"],
    >>>     "packages": [
    >>>         {
    >>>             "name": "maven:io.sentry.sentry",
    >>>             "version": "1.7.10",
    >>>         }
    >>>     ]
    >>> }
    """

    @classmethod
    def to_python(cls, data, **kwargs):
        for key in ("name", "version", "integrations", "packages"):
            data.setdefault(key, None)

        return super().to_python(data, **kwargs)

    def to_json(self):
        """
        Convert a Python package to a JSON object.

        :param name: The name of the package.
        :type name: str, optional
        :param version: The version of the
        package. Defaults to None. If not provided, will be set to 'latest'. This is usually done for packages that are not yet released or in development
        environments where you don't know what their version will be until it's finished and released.  You can also provide ``'latest'`` as a string if you
        want this field to be explicitly set as such even though it's the default value (i.e., so that your code doesn't change behavior depending on whether
        or not you pass in an explicit value).  This is preferred over setting ``None`` because ``None`` may become an actual version number in future
        releases which could break your code! If there are multiple versions available for this package, then
        :attr`~pypackage_to_jsonable._PackageToJSONableMixin__packages` should contain at least one dictionary with key/value pairs corresponding to those
        options; if only one option is available then :attr`~pypackage_to_jsonable._PackageToJSONableMixin__packages` should just
        """
        return prune_empty_keys(
            {
                "name": self.name,
                "version": self.version,
                "integrations": self.integrations or None,
                "packages": self.packages or None,
            }
        )

    def get_api_context(self, is_public=False, platform=None):
        return {"name": self.name, "version": self.version}

    def get_api_meta(self, meta, is_public=False, platform=None):
        return {"": meta.get(""), "name": meta.get("name"), "version": meta.get("version")}
