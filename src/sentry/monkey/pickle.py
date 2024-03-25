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
# [0]: https://rebeccabilbro.github.io/convert-py2-pickles-to-py3/#python-2-objects-vs-python-3-objects


def _record_pickle_failure(metric_name: str, e: Exception) -> None:
    from sentry.utils import metrics

    metrics.incr(metric_name, sample_rate=1)

    import random

    from sentry import options

    if options.get("pickle.send-error-to-sentry") >= random.random():
        import logging

        msg = f"{metric_name}.{type(e).__name__}: {e}"
        # exc_info=(None, None, None) gives us a full traceback
        logging.getLogger(__name__).error(msg, exc_info=(None, None, None))


def patch_pickle_loaders():
    import pickle

    original_pickle_load = pickle.load
    original_pickle_loads = pickle.loads
    original_pickle_Unpickler = pickle.Unpickler

    # Patched Picker and Unpickler
    #
    # A NOTE on these Compat service classes. Unfortunately because pickle is a
    # C module we can't subclass, so instead we just delegate with __getattr__.
    # It's very possible we missed some more subtle uses of the classes here.

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
            except UnicodeDecodeError as e:
                _record_pickle_failure(
                    "pickle.compat_pickle_pickler_load.had_unicode_decode_error", e
                )

                # We must seek back to the start of the buffer to depickle
                # again after failing above, without this we'll get a buffer
                # underflow error during the depickle.
                self.__orig_args[0].seek(0)

                # Rebuild the Unpickler with modified encoding, only if it was left unset
                self.__orig_kwargs["encoding"] = self.__orig_kwargs.get("encoding", "latin-1")
                self.__make_unpickler()
                return self.__unpickler.load()

    # Patched load and loads

    def py3_compat_pickle_load(*args, **kwargs):
        try:
            return original_pickle_load(*args, **kwargs)
        except UnicodeDecodeError as e:
            _record_pickle_failure("pickle.compat_pickle_load.had_unicode_decode_error", e)

            kwargs["encoding"] = kwargs.get("encoding", "latin-1")
            return original_pickle_load(*args, **kwargs)

    def py3_compat_pickle_loads(*args, **kwargs):
        try:
            return original_pickle_loads(*args, **kwargs)
        except UnicodeDecodeError as e:
            _record_pickle_failure("pickle.compat_pickle_loads.had_unicode_decode_error", e)

            kwargs["encoding"] = kwargs.get("encoding", "latin-1")
            return original_pickle_loads(*args, **kwargs)

    pickle.load = py3_compat_pickle_load
    pickle.loads = py3_compat_pickle_loads
    pickle.Unpickler = CompatUnpickler
