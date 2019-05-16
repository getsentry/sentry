from __future__ import absolute_import

import six

from symbolic import LineInfo, parse_addr

from sentry.utils.safe import trim
from sentry.utils.compat import implements_to_string
from sentry.models import EventError
from sentry.lang.native.utils import image_name
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

    # Emitted for e.g. broken minidumps
    EventError.NATIVE_SYMBOLICATOR_FAILED,

    # We want to let the user know when calling symbolicator failed, even
    # though it's not user fixable.
    EventError.NATIVE_INTERNAL_FAILURE,
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
    """This symbolizer dispatches to both symbolicator and the system symbols
    we have in the database and reports errors slightly differently.
    """

    def _process_frame(self, sym, package=None, addr_off=0):
        frame = {
            'sym_addr': '0x%x' % (sym.sym_addr + addr_off,),
            'instruction_addr': '0x%x' % (sym.instr_addr + addr_off,),
            'lineno': sym.line,
        }

        symbol = trim(sym.symbol, MAX_SYM)
        function = sym.function_name

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
        if all(x["status"] == "symbolicated" for x in symbolicator_match) or symbolicator_match == []:
            return symbolicator_match

        # Then we check the symbolserver for a match.
        return self._convert_symbolserver_match(instruction_addr, symbolserver_match)
