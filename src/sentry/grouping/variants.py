from __future__ import absolute_import

from sentry.grouping.utils import hash_from_values, is_default_fingerprint_var


class BaseVariant(object):
    # The type of the variant that is reported to the UI.
    type = None

    # This is true if `get_hash` does not return `None`.
    contributes = True

    def get_hash(self):
        return None

    @property
    def description(self):
        return self.type

    def _get_metadata_as_dict(self):
        return {}

    def as_dict(self):
        rv = {"type": self.type, "description": self.description, "hash": self.get_hash()}
        rv.update(self._get_metadata_as_dict())
        return rv

    def encode_for_similarity(self):
        raise NotImplementedError()

    def __repr__(self):
        return "<%s %r (%s)>" % (self.__class__.__name__, self.get_hash(), self.type)


class ChecksumVariant(BaseVariant):
    """A checksum variant returns a single hardcoded hash."""

    type = "checksum"

    def __init__(self, hash, hashed=False):
        self.hash = hash
        self.hashed = hashed

    @property
    def description(self):
        if self.hashed:
            return "hashed legacy checksum"
        return "legacy checksum"

    def encode_for_similarity(self):
        return ()

    def get_hash(self):
        return self.hash


class FallbackVariant(BaseVariant):
    id = "fallback"
    contributes = True

    def encode_for_similarity(self):
        return ()

    def get_hash(self):
        return hash_from_values([])


class ComponentVariant(BaseVariant):
    """A component variant is a variant that produces a hash from the
    `GroupComponent` it encloses.
    """

    type = "component"

    def __init__(self, component, config):
        self.component = component
        self.config = config

    @property
    def description(self):
        return self.component.description

    @property
    def contributes(self):
        return self.component.contributes

    def get_hash(self):
        return self.component.get_hash()

    def encode_for_similarity(self):
        return self.component.encode_for_similarity()

    def _get_metadata_as_dict(self):
        return {"component": self.component.as_dict(), "config": self.config.as_dict()}


class CustomFingerprintVariant(BaseVariant):
    """A completely custom fingerprint."""

    type = "custom-fingerprint"

    def __init__(self, values):
        self.values = values

    @property
    def description(self):
        return "custom fingerprint"

    def get_hash(self):
        return hash_from_values(self.values)

    def encode_for_similarity(self):
        for value in self.values:
            yield ("fingerprint", "ident-shingle"), [value]

    def _get_metadata_as_dict(self):
        return {"values": self.values}


class SaltedComponentVariant(ComponentVariant):
    """A salted version of a component."""

    type = "salted-component"

    def __init__(self, values, component, config):
        ComponentVariant.__init__(self, component, config)
        self.values = values

    @property
    def description(self):
        return "modified " + self.component.description

    def get_hash(self):
        if not self.component.contributes:
            return None
        final_values = []
        for value in self.values:
            if is_default_fingerprint_var(value):
                final_values.extend(self.component.iter_values())
            else:
                final_values.append(value)
        return hash_from_values(final_values)

    def encode_for_similarity(self):
        for x in ComponentVariant.encode_for_similarity(self):
            yield x

        for value in self.values:
            if not is_default_fingerprint_var(value):
                yield ("fingerprint", "ident-shingle"), [value]

    def _get_metadata_as_dict(self):
        rv = ComponentVariant._get_metadata_as_dict(self)
        rv["values"] = self.values
        return rv
