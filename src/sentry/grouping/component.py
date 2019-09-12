from __future__ import absolute_import

from sentry.grouping.utils import hash_from_values


DEFAULT_HINTS = {"salt": "a static salt"}

# When a component ID appears here it has a human readable name which also
# makes it a major component.  A major component is described as such for
# the UI.
KNOWN_MAJOR_COMPONENT_NAMES = {
    "app": "in-app",
    "exception": "exception",
    "stacktrace": "stacktrace",
    "threads": "thread",
    "hostname": "hostname",
    "violation": "violation",
    "uri": "URL",
    "message": "message",
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
            return " ".join(items[-1])
        return self.name or "others"

    def get_subcomponent(self, id, only_contributing=False):
        """Looks up a subcomponent by the id and returns the first or `None`."""
        return next(self.iter_subcomponents(id=id, only_contributing=only_contributing), None)

    def iter_subcomponents(self, id, recursive=False, only_contributing=False):
        """Finds all subcomponents matching an id, optionally recursively."""
        for value in self.values:
            if isinstance(value, GroupingComponent):
                if only_contributing and not value.contributes:
                    continue
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

    def iter_values(self):
        """Recursively walks the component and flattens it into a list of
        values.
        """
        if self.contributes:
            for value in self.values:
                if isinstance(value, GroupingComponent):
                    for x in value.iter_values():
                        yield x
                else:
                    yield value

    def get_hash(self):
        """Returns the hash of the values if it contributes."""
        if self.contributes:
            return hash_from_values(self.iter_values())

    def as_dict(self):
        """Converts the component tree into a dictionary."""
        rv = {
            "id": self.id,
            "name": self.name,
            "contributes": self.contributes,
            "hint": self.hint,
            "values": [],
        }
        for value in self.values:
            if isinstance(value, GroupingComponent):
                rv["values"].append(value.as_dict())
            else:
                # this basically assumes that a value is only a primitive
                # and never an object or list.  This should be okay
                # because we verify this.
                rv["values"].append(value)
        return rv

    def __repr__(self):
        return "GroupingComponent(%r, hint=%r, contributes=%r, values=%r)" % (
            self.id,
            self.hint,
            self.contributes,
            self.values,
        )
