import collections
import logging
import pickle
from base64 import b64encode
from uuid import uuid4

from django.db.models.signals import post_delete

from sentry import nodestore
from sentry.db.models.utils import Creator
from sentry.utils.cache import memoize
from sentry.utils.canonical import CANONICAL_TYPES, CanonicalKeyDict
from sentry.utils.strings import compress, decompress

from .gzippeddict import GzippedDictField

__all__ = ("NodeField", "NodeData")

logger = logging.getLogger("sentry")


class NodeIntegrityFailure(Exception):
    pass


class NodeData(collections.MutableMapping):
    """
    A wrapper for nodestore data that fetches the underlying data
    from nodestore.

    Initializing with:
    data=None means, this is a node that needs to be fetched from nodestore.
    data={...} means, this is an object that should be saved to nodestore.
    """

    def __init__(self, id, data=None, wrapper=None, ref_version=None, ref_func=None):
        self.id = id
        self.ref = None
        # ref version is used to discredit a previous ref
        # (this does not mean the Event is mutable, it just removes ref checking
        #  in the case of something changing on the data model)
        self.ref_version = ref_version
        self.ref_func = ref_func
        self.wrapper = wrapper
        if data is not None and self.wrapper is not None:
            data = self.wrapper(data)
        self._node_data = data

    def __getstate__(self):
        data = dict(self.__dict__)
        # downgrade this into a normal dict in case it's a shim dict.
        # This is needed as older workers might not know about newer
        # collection types.  For instance we have events where this is a
        # CanonicalKeyDict
        data.pop("data", None)
        data["_node_data_CANONICAL"] = isinstance(data["_node_data"], CANONICAL_TYPES)
        data["_node_data"] = dict(data["_node_data"].items())
        return data

    def __setstate__(self, state):
        # If there is a legacy pickled version that used to have data as a
        # duplicate, reject it.
        state.pop("data", None)
        if state.pop("_node_data_CANONICAL", False):
            state["_node_data"] = CanonicalKeyDict(state["_node_data"])
        self.__dict__ = state

    def __getitem__(self, key):
        return self.data[key]

    def __setitem__(self, key, value):
        self.data[key] = value

    def __delitem__(self, key):
        del self.data[key]

    def __iter__(self):
        return iter(self.data)

    def __len__(self):
        return len(self.data)

    def __repr__(self):
        cls_name = type(self).__name__
        if self._node_data:
            return f"<{cls_name}: id={self.id} data={self._node_data!r}>"
        return f"<{cls_name}: id={self.id}>"

    def get_ref(self, instance):
        if not self.ref_func:
            return
        return self.ref_func(instance)

    def copy(self):
        return self.data.copy()

    @memoize
    def data(self):
        """
        Get the current data object, fetching from nodestore if necessary.
        """

        if self._node_data is not None:
            return self._node_data

        elif self.id:
            self.bind_data(nodestore.get(self.id) or {})
            return self._node_data

        rv = {}
        if self.wrapper is not None:
            rv = self.wrapper(rv)
        return rv

    def bind_data(self, data, ref=None):
        self.ref = data.pop("_ref", ref)
        ref_version = data.pop("_ref_version", None)
        if ref_version == self.ref_version and ref is not None and self.ref != ref:
            raise NodeIntegrityFailure(
                f"Node reference for {self.id} is invalid: {ref} != {self.ref}"
            )
        if self.wrapper is not None:
            data = self.wrapper(data)
        self._node_data = data

    def bind_ref(self, instance):
        ref = self.get_ref(instance)
        if ref:
            self.data["_ref"] = ref
            self.data["_ref_version"] = self.ref_version

    def save(self, subkeys=None):
        """
        Write current data back to nodestore.

        :param subkeys: Additional JSON payloads to attach to nodestore value,
            currently only {"unprocessed": {...}} is added for reprocessing.
            See documentation of nodestore.
        """

        # We never loaded any data for reading or writing, so there
        # is nothing to save.
        if self._node_data is None:
            return

        # We can't put our wrappers into the nodestore, so we need to
        # ensure that the data is converted into a plain old dict
        to_write = self._node_data
        if isinstance(to_write, CANONICAL_TYPES):
            to_write = dict(to_write.items())

        subkeys = subkeys or {}
        subkeys[None] = to_write

        nodestore.set_subkeys(self.id, subkeys)


class NodeField(GzippedDictField):
    """
    Similar to the gzippedictfield except that it stores a reference
    to an external node.
    """

    def __init__(self, *args, **kwargs):
        self.ref_func = kwargs.pop("ref_func", None)
        self.ref_version = kwargs.pop("ref_version", None)
        self.wrapper = kwargs.pop("wrapper", None)
        self.id_func = kwargs.pop("id_func", lambda: b64encode(uuid4().bytes))
        super().__init__(*args, **kwargs)

    def contribute_to_class(self, cls, name):
        super().contribute_to_class(cls, name)
        setattr(cls, name, Creator(self))
        post_delete.connect(self.on_delete, sender=self.model, weak=False)

    def on_delete(self, instance, **kwargs):
        value = getattr(instance, self.name)
        if not value.id:
            return

        nodestore.delete(value.id)

    def to_python(self, value):
        node_id = None
        # If value is a string, we assume this is a value we've loaded from the
        # database, it should be decompressed/unpickled, and we should end up
        # with a dict.
        if value and isinstance(value, str):
            try:
                value = pickle.loads(decompress(value))
            except Exception as e:
                # TODO this is a bit dangerous as a failure to read/decode the
                # node_id will end up with this record being replaced with an
                # empty value under a new key, potentially orphaning an
                # original value in nodestore. OTOH if we can't decode the info
                # here, the node was already effectively orphaned.
                logger.exception(e)
                value = None

        if value:
            if "node_id" in value:
                node_id = value.pop("node_id")
                # If the value is now empty, that means that it only had the
                # node_id in it, which means that we should be looking to *load*
                # the event body from nodestore. If it does have other stuff in
                # it, that means we got an event body with a precomputed id in
                # it, and we want to *save* the rest of the body to nodestore.
                if value == {}:
                    value = None
        else:
            # Either we were passed a null/empty value in the constructor, or
            # we failed to decode the value from the database so we have no id
            # to load data from, and no data to save.
            value = None

        return NodeData(
            node_id,
            value,
            wrapper=self.wrapper,
            ref_version=self.ref_version,
            ref_func=self.ref_func,
        )

    def get_prep_value(self, value):
        """
        Prepares the NodeData to be written in a Model.save() call.

        Makes sure the event body is written to nodestore and
        returns the node_id reference to be written to rowstore.
        """
        if not value and self.null:
            # save ourselves some storage
            return None

        if value.id is None:
            value.id = self.id_func()

        value.save()
        return compress(pickle.dumps({"node_id": value.id}))
