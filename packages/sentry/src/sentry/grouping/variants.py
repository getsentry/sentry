from sentry.grouping.utils import hash_from_values, is_default_fingerprint_var


class BaseVariant:
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
        return f"<{self.__class__.__name__} {self.get_hash()!r} ({self.type})>"


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


def expose_fingerprint_dict(values, info=None):
    rv = {
        "values": values,
    }
    if not info:
        return rv

    from sentry.grouping.fingerprinting import Rule

    client_values = info.get("client_fingerprint")
    if client_values and (
        len(client_values) != 1 or not is_default_fingerprint_var(client_values[0])
    ):
        rv["client_values"] = client_values
    matched_rule = info.get("matched_rule")
    if matched_rule:
        rule = Rule.from_json(matched_rule)
        rv["matched_rule"] = rule.text

    return rv


class CustomFingerprintVariant(BaseVariant):
    """A completely custom fingerprint."""

    type = "custom-fingerprint"

    def __init__(self, values, fingerprint_info=None):
        self.values = values
        self.info = fingerprint_info

    @property
    def description(self):
        return "custom fingerprint"

    def get_hash(self):
        return hash_from_values(self.values)

    def encode_for_similarity(self):
        for value in self.values:
            yield ("fingerprint", "ident-shingle"), [value]

    def _get_metadata_as_dict(self):
        return expose_fingerprint_dict(self.values, self.info)


class SaltedComponentVariant(ComponentVariant):
    """A salted version of a component."""

    type = "salted-component"

    def __init__(self, values, component, config, fingerprint_info=None):
        ComponentVariant.__init__(self, component, config)
        self.values = values
        self.info = fingerprint_info

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
        yield from ComponentVariant.encode_for_similarity(self)

        for value in self.values:
            if not is_default_fingerprint_var(value):
                yield ("fingerprint", "ident-shingle"), [value]

    def _get_metadata_as_dict(self):
        rv = ComponentVariant._get_metadata_as_dict(self)
        rv.update(expose_fingerprint_dict(self.values, self.info))
        return rv


# defines the order of hierarchical grouping hashes, globally. variant names
# defined in this list
#
# 1) will be persisted in snuba for split/unsplit operations
# 2) in save_event, will be traversed bottom-to-top, and the first GroupHash
#    found is used to find/create group
#
# variants outside of this list are assumed to not contribute to any sort of
# hierarchy, their hashes are always persisted as GroupHash (and used to find
# existing groups)
HIERARCHICAL_VARIANTS = [
    "app-depth-1",  # hashing by 1 level of stacktrace (eg just crashing frame)
    "app-depth-2",
    "app-depth-3",
    "app-depth-4",
    "app-depth-5",
    "app-depth-max",  # hashing by full stacktrace
]
