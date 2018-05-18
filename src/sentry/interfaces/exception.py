"""
sentry.interfaces.exception
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

__all__ = ('Exception', 'Mechanism', 'upgrade_legacy_mechanism')

import re
import six

from django.conf import settings

from sentry.interfaces.base import Interface, InterfaceValidationError
from sentry.interfaces.schemas import validate_and_default_interface
from sentry.interfaces.stacktrace import Stacktrace, slim_frame_data
from sentry.utils import json
from sentry.utils.safe import trim

_type_value_re = re.compile('^(\w+):(.*)$')

WELL_KNOWN_ERRNO = {
    # TODO(ja)
}

WELL_KNOWN_SIGNALS = {
    # TODO(ja)
}

WELL_KNOWN_SIGNAL_CODES = {
    # TODO(ja)
}

WELL_KNOWN_EXCEPTIONS = {
    # TODO(ja)
}


def upgrade_legacy_mechanism(data):
    """
    Conversion from mechanism objects sent by old sentry-cocoa SDKs. It assumes
    "type": "generic" and moves "posix_signal", "mach_exception" into "meta".
    All other keys are moved into "data".

    Example old payload:
    >>> {
    >>>     "posix_signal": {
    >>>         "name": "SIGSEGV",
    >>>         "code_name": "SEGV_NOOP",
    >>>         "signal": 11,
    >>>         "code": 0
    >>>     },
    >>>     "relevant_address": "0x1",
    >>>     "mach_exception": {
    >>>         "exception": 1,
    >>>         "exception_name": "EXC_BAD_ACCESS",
    >>>         "subcode": 8,
    >>>         "code": 1
    >>>     }
    >>> }

    Example normalization:
    >>> {
    >>>     "type": "mach",
    >>>     "description": "TODO",
    >>>     "data": {
    >>>         "relevant_address": "0x1"
    >>>     },
    >>>     "meta": {
    >>>         "mach_exception": {
    >>>             "exception": 1,
    >>>             "subcode": 8,
    >>>             "code": 1,
    >>>             "name": "EXC_BAD_ACCESS"
    >>>         },
    >>>         "signal": {
    >>>             "number": 11,
    >>>             "code": 0,
    >>>             "name": "SIGSEGV",
    >>>             "code_name": "SEGV_NOOP"
    >>>         }
    >>>     }
    >>> }
    """

    # Early exit for current protocol. We assume that when someone sends a
    # "type", we do not need to preprocess and can immediately validate
    if data is None or data.get('type') is not None:
        return data

    result = {'type': 'generic'}

    # "posix_signal" and "mach_exception" were optional root-level objects,
    # which have now moved to special keys inside "meta". We only create "meta"
    # if there is actual data to add.

    posix_signal = data.pop('posix_signal', None)
    if posix_signal and posix_signal.get('signal'):
        result.setdefault('meta', {})['signal'] = {
            'number': posix_signal.get('signal'),
            'code': posix_signal.get('code'),
            'name': posix_signal.get('name'),
            'code_name': posix_signal.get('code_name'),
        }

    mach_exception = data.pop('mach_exception', None)
    if mach_exception:
        result.setdefault('meta', {})['mach_exception'] = {
            'exception': mach_exception.get('exception'),
            'code': mach_exception.get('code'),
            'subcode': mach_exception.get('subcode'),
            'name': mach_exception.get('exception_name'),
        }

    # All remaining data has to be moved to the "data" key. We assume that even
    # if someone accidentally sent a corret top-level key (such as "handled"),
    # it will not pass our interface validation and should be moved to "data"
    # instead.
    result.setdefault('data', {}).update(data)
    return result


def to_hex_code(code):
    if code is None:
        return None
    elif isinstance(code, six.integer_types):
        rv = '0x%x' % code
    elif isinstance(code, six.string_types):
        if code[:2] == '0x':
            code = int(code[2:], 16)
        rv = '0x%x' % int(code)
    else:
        raise ValueError('Unsupported format %r' % (code, ))
    if len(rv) > 24:
        raise ValueError('Value too long %r' % (rv, ))
    return rv


def prune_empty_keys(obj):
    if obj is None:
        return None

    return dict((k, v) for k, v in six.iteritems(obj) if (v == 0 or v is False or v))


class Mechanism(Interface):
    """
    an optional field residing in the exception interface. It carries additional
    information about the way the exception was created on the target system.
    This includes general exception values obtained from operating system or
    runtime APIs, as well as mechanism-specific values.

    >>> {
    >>>     "type": "mach",
    >>>     "description": "EXC_BAD_ACCESS",
    >>>     "data": {
    >>>         "relevant_address": "0x1"
    >>>     },
    >>>     "handled": false,
    >>>     "help_link": "https://developer.apple.com/library/content/qa/qa1367/_index.html",
    >>>     "meta": {
    >>>         "mach_exception": {
    >>>              "exception": 1,
    >>>              "subcode": 8,
    >>>              "code": 1
    >>>         },
    >>>         "signal": 11
    >>>             "number": 11
    >>>         }
    >>>     }
    >>> }
    """

    path = 'mechanism'

    @classmethod
    def to_python(cls, data):
        data = upgrade_legacy_mechanism(data)
        is_valid, errors = validate_and_default_interface(data, cls.path)
        if not is_valid:
            raise InterfaceValidationError("Invalid mechanism")

        if not data.get('type'):
            raise InterfaceValidationError("No 'type' present")

        meta = data.get('meta', {})
        mach_exception = meta.get('mach_exception')
        if mach_exception is not None:
            mach_exception = {
                'exception': mach_exception['exception'],
                'code': mach_exception['code'],
                'subcode': mach_exception['subcode'],
                'name': mach_exception['name'] or (
                    WELL_KNOWN_EXCEPTIONS.get(mach_exception['exception'])),
            }

        signal = meta.get('signal')
        if signal is not None:
            signal = {
                'number': signal['number'],
                'code': signal.get('code'),
                'name': signal.get('name') or (
                    WELL_KNOWN_SIGNALS.get(signal['number'])),
                'code_name': signal.get('code_name') or (
                    WELL_KNOWN_SIGNAL_CODES.get(signal.get('code'))),
            }

        errno = meta.get('errno')
        if errno is not None:
            errno = {
                'number': errno['number'],
                'name': errno.get('name') or (
                    WELL_KNOWN_ERRNO.get(errno['number'])),
            }

        kwargs = {
            'type': trim(data['type'], 128),
            'description': trim(data.get('description'), 1024),
            'help_link': trim(data.get('help_link'), 1024),
            'handled': data.get('handled'),
            'data': trim(data.get('data'), 4096),
            'meta': {
                'errno': errno,
                'mach_exception': mach_exception,
                'signal': signal,
            },
        }

        return cls(**kwargs)

    def to_json(self):
        return prune_empty_keys({
            'type': self.type,
            'description': self.description,
            'help_link': self.help_link,
            'handled': self.handled,
            'data': self.data,
            'meta': prune_empty_keys(self.meta),
        })

    def get_path(self):
        return self.path


class SingleException(Interface):
    """
    A standard exception with a ``type`` and value argument, and an optional
    ``module`` argument describing the exception class type and
    module namespace. Either ``type`` or ``value`` must be present.

    You can also optionally bind a stacktrace interface to an exception. The
    spec is identical to ``sentry.interfaces.Stacktrace``.

    >>> {
    >>>     "type": "ValueError",
    >>>     "value": "My exception value",
    >>>     "module": "__builtins__",
    >>>     "mechanism": {},
    >>>     "stacktrace": {
    >>>         # see sentry.interfaces.Stacktrace
    >>>     }
    >>> }
    """
    score = 2000
    path = 'sentry.interfaces.Exception'

    @classmethod
    def to_python(cls, data, slim_frames=True):
        is_valid, errors = validate_and_default_interface(data, cls.path)
        if not is_valid:
            raise InterfaceValidationError("Invalid exception")

        if not (data.get('type') or data.get('value')):
            raise InterfaceValidationError("No 'type' or 'value' present")

        if data.get('stacktrace') and data['stacktrace'].get('frames'):
            stacktrace = Stacktrace.to_python(
                data['stacktrace'],
                slim_frames=slim_frames,
            )
        else:
            stacktrace = None

        if data.get('raw_stacktrace') and data['raw_stacktrace'].get('frames'):
            raw_stacktrace = Stacktrace.to_python(
                data['raw_stacktrace'], slim_frames=slim_frames, raw=True
            )
        else:
            raw_stacktrace = None

        type = data.get('type')
        value = data.get('value')
        if isinstance(value, six.string_types):
            if type is None:
                m = _type_value_re.match(value)
                if m:
                    type = m.group(1)
                    value = m.group(2).strip()
        elif value is not None:
            value = json.dumps(value)

        value = trim(value, 4096)

        if data.get('mechanism'):
            mechanism = Mechanism.to_python(data['mechanism'])
        else:
            mechanism = None

        kwargs = {
            'type': trim(type, 128),
            'value': value,
            'module': trim(data.get('module'), 128),
            'mechanism': mechanism,
            'stacktrace': stacktrace,
            'thread_id': trim(data.get('thread_id'), 40),
            'raw_stacktrace': raw_stacktrace,
        }

        return cls(**kwargs)

    def to_json(self):
        if self.mechanism:
            mechanism = self.mechanism.to_json()
        else:
            mechanism = None

        if self.stacktrace:
            stacktrace = self.stacktrace.to_json()
        else:
            stacktrace = None

        if self.raw_stacktrace:
            raw_stacktrace = self.raw_stacktrace.to_json()
        else:
            raw_stacktrace = None

        return {
            'type': self.type,
            'value': self.value,
            'mechanism': mechanism,
            'module': self.module,
            'stacktrace': stacktrace,
            'thread_id': self.thread_id,
            'raw_stacktrace': raw_stacktrace,
        }

    def get_api_context(self, is_public=False):
        if self.mechanism:
            mechanism = self.mechanism.to_json()
        else:
            mechanism = None

        if self.stacktrace:
            stacktrace = self.stacktrace.get_api_context(is_public=is_public)
        else:
            stacktrace = None

        if self.raw_stacktrace:
            raw_stacktrace = self.raw_stacktrace.get_api_context(is_public=is_public)
        else:
            raw_stacktrace = None

        return {
            'type': self.type,
            'value': six.text_type(self.value) if self.value else None,
            'mechanism': mechanism,
            'threadId': self.thread_id,
            'module': self.module,
            'stacktrace': stacktrace,
            'rawStacktrace': raw_stacktrace,
        }

    def get_alias(self):
        return 'exception'

    def get_path(self):
        return self.path

    def get_hash(self, platform=None):
        output = None
        if self.stacktrace:
            output = self.stacktrace.get_hash(platform=platform)
            if output and self.type:
                output.append(self.type)
        if not output:
            output = [s for s in [self.type, self.value] if s]
        return output


class Exception(Interface):
    """
    An exception consists of a list of values. In most cases, this list
    contains a single exception, with an optional stacktrace interface.

    Each exception has a mandatory ``value`` argument and optional ``type`` and
    ``module`` arguments describing the exception class type and module
    namespace.

    You can also optionally bind a stacktrace interface to an exception. The
    spec is identical to ``sentry.interfaces.Stacktrace``.

    >>> {
    >>>     "values": [{
    >>>         "type": "ValueError",
    >>>         "value": "My exception value",
    >>>         "module": "__builtins__",
    >>>         "mechanism": {
    >>>             # see sentry.interfaces.Mechanism
    >>>         },
    >>>         "stacktrace": {
    >>>             # see sentry.interfaces.Stacktrace
    >>>         }
    >>>     }]
    >>> }

    Values should be sent oldest to newest, this includes both the stacktrace
    and the exception itself.

    .. note:: This interface can be passed as the 'exception' key in addition
              to the full interface path.
    """

    score = 2000

    def __getitem__(self, key):
        return self.values[key]

    def __iter__(self):
        return iter(self.values)

    def __len__(self):
        return len(self.values)

    @classmethod
    def to_python(cls, data):
        if 'values' not in data:
            data = {'values': [data]}

        if not data['values']:
            raise InterfaceValidationError("No 'values' present")

        if not isinstance(data['values'], list):
            raise InterfaceValidationError("Invalid value for 'values'")

        kwargs = {
            'values': [SingleException.to_python(
                v,
                slim_frames=False,
            ) for v in data['values']],
        }

        if data.get('exc_omitted'):
            if len(data['exc_omitted']) != 2:
                raise InterfaceValidationError("Invalid value for 'exc_omitted'")
            kwargs['exc_omitted'] = data['exc_omitted']
        else:
            kwargs['exc_omitted'] = None

        instance = cls(**kwargs)
        # we want to wait to slim things til we've reconciled in_app
        slim_exception_data(instance)
        return instance

    def to_json(self):
        return {
            'values': [v.to_json() for v in self.values],
            'exc_omitted': self.exc_omitted,
        }

    def get_alias(self):
        return 'exception'

    def get_path(self):
        return 'sentry.interfaces.Exception'

    def compute_hashes(self, platform):
        system_hash = self.get_hash(platform, system_frames=True)
        if not system_hash:
            return []

        app_hash = self.get_hash(platform, system_frames=False)
        if system_hash == app_hash or not app_hash:
            return [system_hash]

        return [system_hash, app_hash]

    def get_hash(self, platform=None, system_frames=True):
        # optimize around the fact that some exceptions might have stacktraces
        # while others may not and we ALWAYS want stacktraces over values
        output = []
        for value in self.values:
            if not value.stacktrace:
                continue
            stack_hash = value.stacktrace.get_hash(
                platform=platform,
                system_frames=system_frames,
            )
            if stack_hash:
                output.extend(stack_hash)
                output.append(value.type)

        if not output:
            for value in self.values:
                output.extend(value.get_hash(platform=platform))

        return output

    def get_api_context(self, is_public=False):
        return {
            'values': [v.get_api_context(is_public=is_public) for v in self.values],
            'hasSystemFrames':
            any(v.stacktrace.get_has_system_frames() for v in self.values if v.stacktrace),
            'excOmitted':
            self.exc_omitted,
        }

    def to_string(self, event, is_public=False, **kwargs):
        if not self.values:
            return ''

        output = []
        for exc in self.values:
            output.append(u'{0}: {1}\n'.format(exc.type, exc.value))
            if exc.stacktrace:
                output.append(
                    exc.stacktrace.
                    get_stacktrace(event, system_frames=False, max_frames=5, header=False) + '\n\n'
                )
        return (''.join(output)).strip()

    def get_stacktrace(self, *args, **kwargs):
        exc = self.values[0]
        if exc.stacktrace:
            return exc.stacktrace.get_stacktrace(*args, **kwargs)
        return ''


def slim_exception_data(instance, frame_allowance=settings.SENTRY_MAX_STACKTRACE_FRAMES):
    """
    Removes various excess metadata from middle frames which go beyond
    ``frame_allowance``.
    """
    # TODO(dcramer): it probably makes sense to prioritize a certain exception
    # rather than distributing allowance among all exceptions
    frames = []
    for exception in instance.values:
        if not exception.stacktrace:
            continue
        frames.extend(exception.stacktrace.frames)

    slim_frame_data(frames, frame_allowance)
