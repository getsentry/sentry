# TODO(python3): Notes on pickle compatibility between 2 + 3:
#
# ## Encoding
#
#  In python, when pickling a data structure, the output is a byte stream. We
#  must tell pickle how to decode byte strings during unpickling that are from
#  python2 in python3.
#
#  Typically we could use the default ASCII decoding, since if correctly used,
#  byte strings should ONLY contain ASCII data. HOWEVER, we must decode as
#  latin-1 due to quirks in how datetime objects are decoded [0].Leaving it
#  as ASCII will result in a decoding error.
#
#  During the 2 -> 3 conversion, we should make a great effort to ensure text
#  values are unicode.
#
#
#  ### Potential problems
#
#  In cases where we encode truly binary data (which must be stored as a string
#  in python2, as there is no bytes type) we will improperly decode it as
#  latin1, resulting in a unicode string in python3 that will contain all kinds
#  of strange characters.
#
#  If we run into this issue when dealing with bytes / strings / unicode. The
#  solution will be to check if we're running py3, and check if the specific
#  field is not the bytes type, but a string, we will have to then encode as
#  `latin-1` to get the bytes back.
#
#
# ## Object Type
#
#  When unpickling python2 objects created as old-style classes, python3 will
#  not know what to do.
#
#  Typically we would have to have some compatibility checking / fixing here
#  (see [0]), but because we do not have any oldstyle objects, we don't need to
#  worry about this.
#
#
# ## What are we patching
#
#  - We patch ALL instances of `pickle_loads` to attempt normal depickling,
#    this will always work in python2, however in python3 if the object
#    contains a datetime object, or non-ASCII str data, it will fail with a
#    UnicodeDecodeError, in which case we will decode strings as latin-1.
#
#  - We patch kombus `pickle_load` function to do the same as above, however
#    because kombu passes in a byte buffer, we have to seek back to the start of
#    the byte buffer to attempt depickling again.
#
#  - At the moment we DO NOT patch `pickle.load`, since it may or may not be
#    the case that we can seek to the start of the passed file-like object. If
#    we do have usages of it, we'll have to patch them specifically based on
#    how the file is passed.
#
# [0]: https://rebeccabilbro.github.io/convert-py2-pickles-to-py3/#python-2-objects-vs-python-3-objects


def patch_pickle_loaders():
    try:
        import kombu.serialization as kombu_serializer
    except ImportError:
        # If kombu hasn't been installed yet don't even attempt to patch pickle
        # functionality. Sentry isn't really running if kombu isn't available.
        return

    import pickle

    # TODO(python3): We use the pickles `2` protocol as it is supported in 2 and 3.
    #
    #  - python3 defaults to a protocol > 2 (depending on the version, see [0]).
    #  - python2 defaults to protocol 2.
    #
    # This is ONLY required for the transition of Python 2 -> 3. There will be
    # a brief period where data may be pickled in python3 (during deploy, or if
    # we rollback), where if we did not declare the version, would be in format
    # that python 2's pickle COULD NOT decode.
    #
    # Once the python3 transition is complete we can use a higher version
    #
    # NOTE: from the documentation:
    #       > The protocol version of the pickle is detected automatically
    #
    # [0]: https://docs.python.org/3/library/pickle.html#pickle-protocols
    #
    # XXX(epurkhiser): Unfortunately changing this module property is NOT
    # enough. Python 3 will use _pickle (aka new cpickle) if it is available
    # (which it usually will be). In this case it will NOT read from
    # DEFAULT_PROTOCOL, as the module functions passthrough to the C
    # implementation, which does not have a mutable DEFAULT_PROTOCOL module
    # property.
    #
    # I'm primarily leaving this here for consistency and documentation
    #
    # XXX(epurkhiser): BIG IMPORTANT NOTE! When changing this, we will have to
    # make some updates to our data pipeline, which currently uses 'pickle.js'
    # to depickle some data using javascript.
    pickle.DEFAULT_PROTOCOL = 2

    # Enforce protocol for kombu as well
    kombu_serializer.pickle_protocol = 2

    original_pickle_load = pickle.load
    original_pickle_dump = pickle.dump
    original_pickle_loads = pickle.loads
    original_pickle_dumps = pickle.dumps
    original_pickle_Pickler = pickle.Pickler
    original_pickle_Unpickler = pickle.Unpickler
    original_kombu_pickle_loads = kombu_serializer.pickle_loads

    # Patched Picker and Unpickler
    #
    # A NOTE on these Compat service classes. Unfortunately because pickle is a
    # C module we can't subclass, so instead we just delegate with __getattr__.
    # It's very possible we missed some more subtle uses of the classes here.

    class CompatPickler:
        def __init__(self, *args, **kwargs):
            # Enforce protocol kwarg as DEFAULT_PROTOCOL. See the comment above
            # DEFAULT_PROTOCOL above to understand why we must pass the kwarg due
            # to _pickle.
            if len(args) == 1:
                kwargs["protocol"] = pickle.DEFAULT_PROTOCOL
            else:
                largs = list(args)
                largs[1] = pickle.DEFAULT_PROTOCOL
                args = tuple(largs)

            self.__pickler = original_pickle_Pickler(*args, **kwargs)

        def __getattr__(self, key):
            return getattr(self.__pickler, key)

    class CompatUnpickler:
        def __init__(self, *args, **kwargs):
            self.__orig_args = args
            self.__orig_kwargs = kwargs
            self.__make_unpickler()

        def __make_unpickler(self):
            self.__unpickler = original_pickle_Unpickler(*self.__orig_args, **self.__orig_kwargs)

        def __getattr__(self, key):
            return getattr(self.__unpickler, key)

        def load(self):
            try:
                return self.__unpickler.load()
            except UnicodeDecodeError:
                from sentry.utils import metrics

                metrics.incr(
                    "pickle.compat_pickle_pickler_load.had_unicode_decode_error", sample_rate=1
                )

                # We must seek back to the start of the buffer to depickle
                # again after failing above, without this we'll get a buffer
                # underflow error during the depickle.
                self.__orig_args[0].seek(0)

                # Rebuild the Unpickler with modified encoding, only if it was left unset
                self.__orig_kwargs["encoding"] = self.__orig_kwargs.get("encoding", "latin-1")
                self.__make_unpickler()
                return self.__unpickler.load()

    # Patched dump and dumps

    def py3_compat_pickle_dump(*args, **kwargs):
        # Enforce protocol kwarg as DEFAULT_PROTOCOL. See the comment above
        # DEFAULT_PROTOCOL above to understand why we must pass the kwarg due
        # to _pickle.
        if len(args) == 1:
            kwargs["protocol"] = pickle.DEFAULT_PROTOCOL
        else:
            largs = list(args)
            largs[1] = pickle.DEFAULT_PROTOCOL
            args = tuple(largs)

        return original_pickle_dump(*args, **kwargs)

    def py3_compat_pickle_dumps(*args, **kwargs):
        # Enforce protocol kwarg as DEFAULT_PROTOCOL. See the comment above
        # DEFAULT_PROTOCOL above to understand why we must pass the kwarg due
        # to _pickle.
        if len(args) == 1:
            kwargs["protocol"] = pickle.DEFAULT_PROTOCOL
        else:
            largs = list(args)
            largs[1] = pickle.DEFAULT_PROTOCOL
            args = tuple(largs)

        return original_pickle_dumps(*args, **kwargs)

    # Patched load and loads

    def py3_compat_pickle_load(*args, **kwargs):
        try:
            return original_pickle_load(*args, **kwargs)
        except UnicodeDecodeError:
            from sentry.utils import metrics

            metrics.incr("pickle.compat_pickle_load.had_unicode_decode_error", sample_rate=1)

            kwargs["encoding"] = kwargs.get("encoding", "latin-1")
            return original_pickle_load(*args, **kwargs)

    def py3_compat_pickle_loads(*args, **kwargs):
        try:
            return original_pickle_loads(*args, **kwargs)
        except UnicodeDecodeError:
            from sentry.utils import metrics

            metrics.incr("pickle.compat_pickle_loads.had_unicode_decode_error", sample_rate=1)

            kwargs["encoding"] = kwargs.get("encoding", "latin-1")
            return original_pickle_loads(*args, **kwargs)

    # patched kombu

    def __py3_compat_kombu_pickle_load(*args, **kwargs):
        """
        This patched pickle.load is specifically used for kombu's `pickle_loads`
        function, with similar logic to above.
        """
        try:
            return original_pickle_load(*args, **kwargs)
        except UnicodeDecodeError:
            from sentry.utils import metrics

            metrics.incr("pickle.compat_kombu_pickle_load.had_unicode_decode_error", sample_rate=1)

            # We must seek back to the start of the BytesIO buffer to depickle
            # again after failing above, without this we'll get a buffer
            # underflow error during the depickle.
            args[0].seek(0)

            kwargs["encoding"] = kwargs.get("encoding", "latin-1")
            return original_pickle_load(*args, **kwargs)

    def py3_compat_kombu_pickle_loads(s, load=__py3_compat_kombu_pickle_load):
        return original_kombu_pickle_loads(s, load)

    pickle.load = py3_compat_pickle_load
    pickle.dump = py3_compat_pickle_dump
    pickle.loads = py3_compat_pickle_loads
    pickle.dumps = py3_compat_pickle_dumps
    pickle.Pickler = CompatPickler
    pickle.Unpickler = CompatUnpickler

    kombu_serializer.pickle_loads = py3_compat_kombu_pickle_loads
