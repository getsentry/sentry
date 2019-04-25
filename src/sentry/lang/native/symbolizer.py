from __future__ import absolute_import

import six

from symbolic import SymbolicError, ObjectLookup, LineInfo, parse_addr

from sentry.utils.safe import trim
from sentry.utils.compat import implements_to_string
from sentry.models import EventError, ProjectDebugFile
from sentry.lang.native.utils import image_name, rebase_addr
from sentry.utils.in_app import is_known_third_party, is_optional_package
from sentry.constants import MAX_SYM

FATAL_ERRORS = (
    EventError.NATIVE_MISSING_DSYM,
    EventError.NATIVE_BAD_DSYM,
    EventError.NATIVE_SYMBOLICATOR_FAILED,
)

USER_FIXABLE_ERRORS = (
    EventError.NATIVE_MISSING_DSYM,
    EventError.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM,
    EventError.NATIVE_BAD_DSYM,
    EventError.NATIVE_MISSING_SYMBOL,

    # XXX: user can't fix this, but they should see it regardless to see it's
    # not their fault. Also better than silently creating an unsymbolicated event
    EventError.NATIVE_SYMBOLICATOR_FAILED,
)


@implements_to_string
class SymbolicationFailed(Exception):
    message = None

    def __init__(self, message=None, type=None, obj=None):
        Exception.__init__(self)
        self.message = six.text_type(message)
        self.type = type
        self.image_name = None
        self.image_path = None
        if obj is not None:
            self.image_uuid = six.text_type(obj.debug_id)
            if obj.name:
                self.image_path = obj.name
                self.image_name = image_name(obj.name)
            self.image_arch = obj.arch
        else:
            self.image_uuid = None
            self.image_arch = None

    @property
    def is_user_fixable(self):
        """These are errors that a user can fix themselves."""
        return self.type in USER_FIXABLE_ERRORS

    @property
    def is_fatal(self):
        """If this is true then a processing issues has to be reported."""
        return self.type in FATAL_ERRORS

    @property
    def is_sdk_failure(self):
        """An error that most likely happened because of a bad SDK."""
        return self.type == EventError.NATIVE_UNKNOWN_IMAGE

    def get_data(self):
        """Returns the event data."""
        rv = {'message': self.message, 'type': self.type}
        if self.image_path is not None:
            rv['image_path'] = self.image_path
        if self.image_uuid is not None:
            rv['image_uuid'] = self.image_uuid
        if self.image_arch is not None:
            rv['image_arch'] = self.image_arch
        return rv

    def __str__(self):
        rv = []
        if self.type is not None:
            rv.append(u'%s: ' % self.type)
        rv.append(self.message or 'no information available')
        if self.image_uuid is not None:
            rv.append(' image-uuid=%s' % self.image_uuid)
        if self.image_name is not None:
            rv.append(' image-name=%s' % self.image_name)
        return u''.join(rv)


class Symbolizer(object):
    """This symbolizer dispatches to both symbolic and the system symbols
    we have in the database and reports errors slightly differently.
    """

    def __init__(self, project, object_lookup, referenced_images,
                 on_dif_referenced=None):
        if not isinstance(object_lookup, ObjectLookup):
            object_lookup = ObjectLookup(object_lookup)
        self.object_lookup = object_lookup

        self.symcaches, self.symcaches_conversion_errors = \
            ProjectDebugFile.difcache.get_symcaches(
                project, referenced_images,
                on_dif_referenced=on_dif_referenced,
                with_conversion_errors=True)

    def _process_frame(self, sym, package=None, addr_off=0):
        frame = {
            'sym_addr': sym.sym_addr + addr_off,
            'instruction_addr': sym.instr_addr + addr_off,
            'lineno': sym.line,
        }
        symbol = trim(sym.symbol, MAX_SYM)
        function = trim(sym.function_name, MAX_SYM)

        frame['function'] = function
        if function != symbol:
            frame['symbol'] = symbol
        else:
            frame['symbol'] = None

        frame['filename'] = trim(sym.rel_path, 256)
        frame['abs_path'] = trim(sym.abs_path, 256)
        if package is not None:
            frame['package'] = package

        return frame

    def _symbolize_app_frame(self, instruction_addr, obj, sdk_info=None, trust=None):
        symcache = self.symcaches.get(obj.debug_id)
        if symcache is None:
            # In case we know what error happened on symcache conversion
            # we can report it to the user now.
            if obj.debug_id in self.symcaches_conversion_errors:
                raise SymbolicationFailed(
                    message=self.symcaches_conversion_errors[obj.debug_id],
                    type=EventError.NATIVE_BAD_DSYM,
                    obj=obj
                )

            if is_optional_package(obj.code_file, sdk_info=sdk_info):
                type = EventError.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM
            else:
                type = EventError.NATIVE_MISSING_DSYM

            raise SymbolicationFailed(type=type, obj=obj)

        try:
            rv = symcache.lookup(rebase_addr(instruction_addr, obj))
        except SymbolicError as e:
            raise SymbolicationFailed(
                type=EventError.NATIVE_BAD_DSYM, message=six.text_type(e), obj=obj
            )

        if not rv:
            # For some frameworks we are willing to ignore missing symbol
            # errors. Also, ignore scanned stack frames when symbols are
            # available to complete breakpad's stack scanning heuristics.
            if trust == 'scan' or is_optional_package(obj.code_file, sdk_info=sdk_info):
                return []
            raise SymbolicationFailed(
                type=EventError.NATIVE_MISSING_SYMBOL, obj=obj)
        return [self._process_frame(s, addr_off=obj.addr) for s in reversed(rv)]

    def _convert_symbolserver_match(self, instruction_addr, symbolserver_match):
        """Symbolizes a frame with system symbols only."""
        if symbolserver_match is None:
            return []

        symbol = symbolserver_match['symbol']
        if symbol[:1] == '_':
            symbol = symbol[1:]

        return [
            self._process_frame(LineInfo(
                sym_addr=parse_addr(symbolserver_match['addr']),
                instr_addr=parse_addr(instruction_addr),
                line=None,
                lang=None,
                symbol=symbol,
            ), package=symbolserver_match['object_name'])
        ]

    def symbolize_frame(self, instruction_addr, sdk_info=None,
                        symbolserver_match=None, symbolicator_match=None,
                        trust=None):
        app_err = None

        # A missing symbolicator match indicates that the symbolicator was not
        # active for this event. Symbolize the app frame directly using
        # symbolic.
        # TODO: Remove this after fully switching to symbolicator
        if symbolicator_match is None:
            obj = self.object_lookup.find_object(instruction_addr)
            if obj is None:
                if trust == 'scan':
                    return []
                raise SymbolicationFailed(type=EventError.NATIVE_UNKNOWN_IMAGE)

            # Try to always prefer the images from the application storage.
            # If the symbolication fails we keep the error for later
            try:
                match = self._symbolize_app_frame(
                    instruction_addr, obj, sdk_info=sdk_info, trust=trust)
                if match:
                    return match
            except SymbolicationFailed as err:
                app_err = err

        # If the symbolicator was used, trust its result. Errors that were
        # generated during symbolication are merged into the event's error
        # array separately and do not need to be handled here. The match
        # returned can either be:
        #  - empty: Symbolicator has explicitly discarded this
        #    frame as a false positive. This happens especially when
        #    stackwalking without CFI.
        #  - all unsymbolicated frames:
        #    Symbolicator was unable to resolve symbols for this frame, so we
        #    fall back to (iOS) symbolserver (see below).
        #  - some unsymbolicated frames:
        #    Symbolicator was able to resolve e.g.
        #    an inline frame but then failed to symbolicate. This is not really
        #    that useful either.
        #
        # TODO: Remove this fallback once symbolicator supports iOS system
        # symbols and fully trust the symbolicator response.
        elif all(x["status"] == "symbolicated" for x in symbolicator_match) or symbolicator_match == []:
            return symbolicator_match

        # Then we check the symbolserver for a match.
        match = self._convert_symbolserver_match(instruction_addr, symbolserver_match)

        # If we do not get a match and the image was from an app bundle
        # and we got an error first, we now fail with the original error
        # as we did indeed encounter a symbolication error.  If however
        # the match was empty we just accept it as a valid symbolication
        # that just did not return any results but without error.
        if app_err is not None \
                and not match \
                and (not obj.code_file or not is_known_third_party(obj.code_file, sdk_info=sdk_info)):
            raise app_err

        return match
