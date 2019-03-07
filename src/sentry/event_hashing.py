from __future__ import absolute_import

import re
import six

from hashlib import md5

from django.utils.encoding import force_bytes

HASH_RE = re.compile(r'^[0-9a-f]{32}$')
DEFAULT_FINGERPRINT_VALUES = frozenset(['{{ default }}', '{{default}}'])


DEFAULT_HINTS = {
    'salt': 'a static salt',
}

# When a component ID appears here it has a human readable name which also
# makes it a major component.  A major component is described as such for
# the UI.
KNOWN_MAJOR_COMPONENT_NAMES = {
    'app': 'in-app',
    'exception': 'exception',
    'stacktrace': 'stacktrace',
    'threads': 'thread',
    'hostname': 'hostname',
    'violation': 'violation',
    'uri': 'URL',
    'message': 'message',
}


def _calculate_contributes(values):
    for value in values or ():
        if not isinstance(value, GroupingComponent) or value.contributes:
            return True
    return False


class GroupingComponent(object):
    """A grouping component is a recursive structure that is flattened
    into components to make a hash for grouping purposes.
    """

    def __init__(self, id, hint=None, contributes=None, values=None):
        self.id = id
        if hint is None:
            hint = DEFAULT_HINTS.get(id)
        self.hint = hint
        if contributes is None:
            contributes = _calculate_contributes(values)
        self.contributes = contributes
        if values is None:
            values = []
        self.values = values

    @property
    def name(self):
        return KNOWN_MAJOR_COMPONENT_NAMES.get(self.id)

    @property
    def description(self):
        items = []

        def _walk_components(c, stack):
            stack.append(c.name)
            for value in c.values:
                if isinstance(value, GroupingComponent) and value.contributes:
                    _walk_components(value, stack)
            parts = filter(None, stack)
            items.append(parts)
            stack.pop()

        _walk_components(self, [])
        items.sort(key=lambda x: (len(x), x))

        if items and items[-1]:
            return ' '.join(items[-1])
        return self.name or 'others'

    def get_subcomponent(self, id):
        """Looks up a subcomponent by the id and returns the first or `None`."""
        return next(self.iter_subcomponents(id), None)

    def iter_subcomponents(self, id, recursive=False):
        """Finds all subcomponents matching an id, optionally recursively."""
        for value in self.values:
            if isinstance(value, GroupingComponent):
                if value.id == id:
                    yield value
                if recursive:
                    for subcomponent in value.iter_subcomponents(id, recursive=True):
                        yield subcomponent

    def update(self, hint=None, contributes=None, values=None):
        """Updates an already existing component with new values."""
        if hint is not None:
            self.hint = hint
        if values is not None:
            if contributes is None:
                contributes = _calculate_contributes(values)
            self.values = values
        if contributes is not None:
            self.contributes = contributes

    def flatten_values(self):
        """Recursively walks the component and flattens it into a list of
        values.
        """
        rv = []
        if self.contributes:
            for value in self.values:
                if isinstance(value, GroupingComponent):
                    rv.extend(value.flatten_values())
                else:
                    rv.append(value)
        return rv

    def get_hash(self):
        """Returns the hash of the values if it contributes."""
        if self.contributes:
            return hash_from_values(self.flatten_values())

    def as_dict(self):
        """Converts the component tree into a dictionary."""
        rv = {
            'id': self.id,
            'name': self.name,
            'contributes': self.contributes,
            'hint': self.hint,
            'values': []
        }
        for value in self.values:
            if isinstance(value, GroupingComponent):
                rv['values'].append(value.as_dict())
            else:
                # this basically assumes that a value is only a primitive
                # and never an object or list.  This should be okay
                # because we verify this.
                rv['values'].append(value)
        return rv

    def __repr__(self):
        return 'GroupingComponent(%r, hint=%r, contributes=%r, values=%r)' % (
            self.id,
            self.hint,
            self.contributes,
            self.values,
        )


class BaseVariant(object):
    type = None

    def get_hash(self):
        return None

    @property
    def description(self):
        return self.type

    def _get_metadata_as_dict(self):
        return {}

    def as_dict(self):
        rv = {
            'type': self.type,
            'description': self.description,
            'hash': self.get_hash(),
        }
        rv.update(self._get_metadata_as_dict())
        return rv

    def __repr__(self):
        return '<%s %r (%s)>' % (
            self.__class__.__name__,
            self.get_hash(),
            self.type,
        )


class ChecksumVariant(BaseVariant):
    """A checksum variant returns a single hardcoded hash."""
    type = 'checksum'

    def __init__(self, hash, hashed=False):
        self.hash = hash
        self.hashed = hashed

    @property
    def description(self):
        if self.hashed:
            return 'hashed legacy checksum'
        return 'legacy checksum'

    def get_hash(self):
        return self.hash


class ComponentVariant(BaseVariant):
    """A component variant is a variant that produces a hash from the
    `GroupComponent` it encloses.
    """
    type = 'component'

    def __init__(self, component):
        self.component = component

    @property
    def description(self):
        return self.component.description

    def get_hash(self):
        return self.component.get_hash()

    def _get_metadata_as_dict(self):
        return {
            'component': self.component.as_dict(),
        }


class CustomFingerprintVariant(BaseVariant):
    """A completely custom fingerprint."""
    type = 'custom-fingerprint'

    def __init__(self, values):
        self.values = values

    @property
    def description(self):
        return 'custom fingerprint'

    def get_hash(self):
        return hash_from_values(self.values)

    def _get_metadata_as_dict(self):
        return {
            'values': self.values,
        }


class SaltedComponentVariant(BaseVariant):
    """A salted version of a component."""
    type = 'salted-component'

    def __init__(self, values, component):
        self.values = values
        self.component = component

    @property
    def description(self):
        return 'modified ' + self.component.description

    def get_hash(self):
        if not self.component.contributes:
            return None
        final_values = []
        for value in self.values:
            if value in DEFAULT_FINGERPRINT_VALUES:
                final_values.extend(self.component.flatten_values())
            else:
                final_values.append(value)
        return hash_from_values(final_values)

    def _get_metadata_as_dict(self):
        return {
            'values': self.values,
            'component': self.component.as_dict(),
        }


def hash_from_values(values):
    result = md5()
    for value in values:
        result.update(force_bytes(value, errors='replace'))
    return result.hexdigest()


def get_calculated_grouping_variants_for_event(event):
    """Given an event this returns a dictionary of the matching grouping
    variants.  Checksum and fingerprinting logic are not handled by this
    function which is handled by `get_grouping_variants_for_event`.
    """
    # This sorts the interfaces by the interface score which gives it the
    # priority which we depend on.
    interfaces = event.get_interfaces()

    winning_strategy = None
    precedence_hint = None
    per_variant_components = {}

    for (strategy_name, interface) in six.iteritems(interfaces):
        rv = interface.get_grouping_component_variants(event.platform)
        for (variant, component) in six.iteritems(rv):
            per_variant_components.setdefault(variant, []).append(component)

            if winning_strategy is None:
                if component.contributes:
                    winning_strategy = strategy_name
                    precedence_hint = '%s takes precedence' % (
                        '%s of %s' % (strategy_name, variant) if
                        variant != 'default' else
                        strategy_name
                    )
            elif component.contributes and winning_strategy != strategy_name:
                component.update(
                    contributes=False,
                    hint=precedence_hint
                )

    rv = {}
    for (variant, components) in six.iteritems(per_variant_components):
        component = GroupingComponent(
            id=variant,
            values=components,
        )
        if not component.contributes and precedence_hint:
            component.update(hint=precedence_hint)
        rv[variant] = component

    return rv


def get_grouping_variants_for_event(event):
    # If a checksum is set the only variant that comes back from this
    # event is the checksum variant.
    checksum = event.data.get('checksum')
    if checksum:
        if HASH_RE.match(checksum):
            return {
                'checksum': ChecksumVariant(checksum),
            }
        return {
            'checksum': ChecksumVariant(checksum),
            'hashed-checksum': ChecksumVariant(hash_from_values(checksum), hashed=True),
        }

    # Otherwise we go to the various forms of fingerprint handling.
    fingerprint = event.data.get('fingerprint') or ['{{ default }}']
    defaults_referenced = sum(1 if d in DEFAULT_FINGERPRINT_VALUES else 0 for d in fingerprint)

    # If no defaults are referenced we produce a single completely custom
    # fingerprint.
    if defaults_referenced == 0:
        return {
            'custom-fingerprint': CustomFingerprintVariant(fingerprint),
        }

    # At this point we need to calculate the default event values.  If the
    # fingerprint is salted we will wrap it.
    components = get_calculated_grouping_variants_for_event(event)
    rv = {}

    # If the fingerprints are unsalted, we can return them right away.
    if defaults_referenced == 1 and len(fingerprint) == 1:
        for (key, component) in six.iteritems(components):
            rv[key] = ComponentVariant(component)

    # Otherwise we need to salt each of the components.
    else:
        for (key, component) in six.iteritems(components):
            rv[key] = SaltedComponentVariant(fingerprint, component)

    return rv


# legacy functionality follows:
#
# This is at present still the main grouping code in the event processing
# but it should be possible to replace all of these with
# `get_grouping_variants_for_event` once we feel more confident that no
# regression ocurred.


def get_hashes_for_event(event):
    interfaces = event.get_interfaces()
    for interface in six.itervalues(interfaces):
        result = interface.compute_hashes(event.platform)
        if not result:
            continue
        return result
    return ['']


def get_hashes_from_fingerprint(event, fingerprint):
    if any(d in fingerprint for d in DEFAULT_FINGERPRINT_VALUES):
        default_hashes = get_hashes_for_event(event)
        hash_count = len(default_hashes)
    else:
        hash_count = 1

    hashes = []
    for idx in range(hash_count):
        result = []
        for bit in fingerprint:
            if bit in DEFAULT_FINGERPRINT_VALUES:
                result.extend(default_hashes[idx])
            else:
                result.append(bit)
        hashes.append(result)
    return hashes


def calculate_event_hashes(event):
    # If a checksum is set, use that one.
    checksum = event.data.get('checksum')
    if checksum:
        if HASH_RE.match(checksum):
            return [checksum]
        return [hash_from_values([checksum]), checksum]

    # Otherwise go with the new style fingerprint code
    fingerprint = event.data.get('fingerprint') or ['{{ default }}']
    return [hash_from_values(h) for h in get_hashes_from_fingerprint(event, fingerprint)]
