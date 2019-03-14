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

from sentry.interfaces.base import Interface, InterfaceValidationError, prune_empty_keys, RUST_RENORMALIZED_DEFAULT
from sentry.interfaces.schemas import validate_and_default_interface
from sentry.interfaces.stacktrace import Stacktrace, slim_frame_data
from sentry.utils import json
from sentry.utils.safe import get_path, trim

_type_value_re = re.compile('^(\w+):(.*)$')


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
    >>>     "type": "generic",
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
        result.setdefault('meta', {})['signal'] = prune_empty_keys({
            'number': posix_signal.get('signal'),
            'code': posix_signal.get('code'),
            'name': posix_signal.get('name'),
            'code_name': posix_signal.get('code_name'),
        })

    mach_exception = data.pop('mach_exception', None)
    if mach_exception:
        result.setdefault('meta', {})['mach_exception'] = prune_empty_keys({
            'exception': mach_exception.get('exception'),
            'code': mach_exception.get('code'),
            'subcode': mach_exception.get('subcode'),
            'name': mach_exception.get('exception_name'),
        })

    # All remaining data has to be moved to the "data" key. We assume that even
    # if someone accidentally sent a corret top-level key (such as "handled"),
    # it will not pass our interface validation and should be moved to "data"
    # instead.
    result.setdefault('data', {}).update(data)
    return result


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
    >>>     "synthetic": false,
    >>>     "help_link": "https://developer.apple.com/library/content/qa/qa1367/_index.html",
    >>>     "meta": {
    >>>         "mach_exception": {
    >>>              "exception": 1,
    >>>              "subcode": 8,
    >>>              "code": 1
    >>>         },
    >>>         "signal": {
    >>>             "number": 11
    >>>         }
    >>>     }
    >>> }
    """

    @classmethod
    def to_python(cls, data, rust_renormalized=RUST_RENORMALIZED_DEFAULT):
        if rust_renormalized:
            for key in (
                'type',
                'synthetic',
                'description',
                'help_link',
                'handled',
                'data',
                'meta',
            ):
                data.setdefault(key, None)

            return cls(**data)

        data = upgrade_legacy_mechanism(data)
        is_valid, errors = validate_and_default_interface(data, cls.path)
        if not is_valid:
            raise InterfaceValidationError("Invalid mechanism")

        if not data.get('type'):
            raise InterfaceValidationError("No 'type' present")

        mechanism_meta = data.get('meta') or {}
        mach_exception = mechanism_meta.get('mach_exception')
        if mach_exception is not None:
            mach_exception = prune_empty_keys({
                'exception': mach_exception['exception'],
                'code': mach_exception['code'],
                'subcode': mach_exception['subcode'],
                'name': mach_exception.get('name'),
            })

        signal = mechanism_meta.get('signal')
        if signal is not None:
            signal = prune_empty_keys({
                'number': signal['number'],
                'code': signal.get('code'),
                'name': signal.get('name'),
                'code_name': signal.get('code_name'),
            })

        errno = mechanism_meta.get('errno')
        if errno is not None:
            errno = prune_empty_keys({
                'number': errno['number'],
                'name': errno.get('name'),
            })

        kwargs = {
            'type': trim(data['type'], 128),
            'synthetic': data.get('synthetic'),
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
            'synthetic': self.synthetic,
            'description': self.description,
            'help_link': self.help_link,
            'handled': self.handled,
            'data': self.data or None,
            'meta': prune_empty_keys(self.meta) or None,
        })

    def iter_tags(self):
        yield (self.path, self.type)

        if self.handled is not None:
            yield ('handled', self.handled and 'yes' or 'no')


def uncontribute_non_stacktrace_variants(variants):
    """If we have multiple variants and at least one has a stacktrace, we
    want to mark all non stacktrace variants non contributing.  The reason
    for this is that otherwise we end up in very generic grouping which has
    some negative consequences for the quality of the groups.
    """
    if len(variants) <= 1:
        return variants
    any_stacktrace_contributes = False
    non_contributing_components = []
    stacktrace_variants = set()

    # In case any of the variants has a contributing stacktrace, we want
    # to make all other variants non contributing.  Thr e
    for (key, component) in six.iteritems(variants):
        if any(s.contributes for s in component.iter_subcomponents(
                id='stacktrace', recursive=True)):
            any_stacktrace_contributes = True
            stacktrace_variants.add(key)
        else:
            non_contributing_components.append(component)

    if any_stacktrace_contributes:
        if len(stacktrace_variants) == 1:
            hint_suffix = 'but the %s variant does' % next(iter(stacktrace_variants))
        else:
            # this branch is basically dead because we only have two
            # variants right now, but this is so this does not break in
            # the future.
            hint_suffix = 'others do'
        for component in non_contributing_components:
            component.update(
                contributes=False,
                hint='ignored because this variant does not contain a '
                'stacktrace, but %s' % hint_suffix
            )

    return variants


class SingleException(Interface):
    """
    A standard exception with a ``type`` and value argument, and an optional
    ``module`` argument describing the exception class type and
    module namespace. Either ``type`` or ``value`` must be present.

    You can also optionally bind a stacktrace interface to an exception. The
    spec is identical to ``stacktrace``.

    >>> {
    >>>     "type": "ValueError",
    >>>     "value": "My exception value",
    >>>     "module": "__builtins__",
    >>>     "mechanism": {},
    >>>     "stacktrace": {
    >>>         # see stacktrace
    >>>     }
    >>> }
    """
    grouping_variants = ['system', 'app']

    @classmethod
    def to_python(cls, data, slim_frames=True, rust_renormalized=RUST_RENORMALIZED_DEFAULT):
        if not rust_renormalized:
            is_valid, errors = validate_and_default_interface(data, cls.path)
            if not is_valid:
                raise InterfaceValidationError("Invalid exception")

            if not (data.get('type') or data.get('value')):
                raise InterfaceValidationError("No 'type' or 'value' present")

        if get_path(data, 'stacktrace', 'frames', filter=True):
            stacktrace = Stacktrace.to_python(
                data['stacktrace'],
                slim_frames=slim_frames,
                rust_renormalized=rust_renormalized
            )
        else:
            stacktrace = None

        if get_path(data, 'raw_stacktrace', 'frames', filter=True):
            raw_stacktrace = Stacktrace.to_python(
                data['raw_stacktrace'], slim_frames=slim_frames, raw=True,
                rust_renormalized=rust_renormalized
            )
        else:
            raw_stacktrace = None

        type = data.get('type')
        value = data.get('value')

        if not rust_renormalized:
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
            mechanism = Mechanism.to_python(data['mechanism'],
                                            rust_renormalized=rust_renormalized)
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
        mechanism = isinstance(self.mechanism, Mechanism) and \
            self.mechanism.to_json() or self.mechanism or None

        if self.stacktrace:
            stacktrace = self.stacktrace.to_json()
        else:
            stacktrace = None

        if self.raw_stacktrace:
            raw_stacktrace = self.raw_stacktrace.to_json()
        else:
            raw_stacktrace = None

        return prune_empty_keys({
            'type': self.type,
            'value': self.value,
            'mechanism': mechanism,
            'module': self.module,
            'stacktrace': stacktrace,
            'thread_id': self.thread_id,
            'raw_stacktrace': raw_stacktrace,
        })

    def get_api_context(self, is_public=False):
        mechanism = isinstance(self.mechanism, Mechanism) and \
            self.mechanism.get_api_context(is_public=is_public) or \
            self.mechanism or None

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

    def get_api_meta(self, meta, is_public=False):
        mechanism_meta = self.mechanism.get_api_meta(meta['mechanism'], is_public=is_public) \
            if isinstance(self.mechanism, Mechanism) and meta.get('mechanism') \
            else None

        stacktrace_meta = self.stacktrace.get_api_meta(meta, is_public=is_public) \
            if self.stacktrace and meta.get('stacktrace') \
            else None

        return {
            '': meta.get(''),
            'type': meta.get('type'),
            'value': meta.get('value'),
            'mechanism': mechanism_meta,
            'threadId': meta.get('thread_id'),
            'module': meta.get('module'),
            'stacktrace': stacktrace_meta,
        }


class Exception(Interface):
    """
    An exception consists of a list of values. In most cases, this list
    contains a single exception, with an optional stacktrace interface.

    Each exception has a mandatory ``value`` argument and optional ``type`` and
    ``module`` arguments describing the exception class type and module
    namespace.

    You can also optionally bind a stacktrace interface to an exception. The
    spec is identical to ``stacktrace``.

    >>> {
    >>>     "values": [{
    >>>         "type": "ValueError",
    >>>         "value": "My exception value",
    >>>         "module": "__builtins__",
    >>>         "mechanism": {
    >>>             # see sentry.interfaces.Mechanism
    >>>         },
    >>>         "stacktrace": {
    >>>             # see stacktrace
    >>>         }
    >>>     }]
    >>> }

    Values should be sent oldest to newest, this includes both the stacktrace
    and the exception itself.

    .. note:: This interface can be passed as the 'exception' key in addition
              to the full interface path.
    """

    score = 2000
    grouping_variants = ['system', 'app']

    def exceptions(self):
        return get_path(self.values, filter=True)

    def __getitem__(self, key):
        return self.exceptions()[key]

    def __iter__(self):
        return iter(self.exceptions())

    def __len__(self):
        return len(self.exceptions())

    @classmethod
    def to_python(cls, data, rust_renormalized=RUST_RENORMALIZED_DEFAULT):
        if not rust_renormalized:
            if data and 'values' not in data and 'exc_omitted' not in data:
                data = {"values": [data]}

        values = get_path(data, 'values', default=[])

        if not rust_renormalized:
            if not isinstance(values, list):
                raise InterfaceValidationError("Invalid value for 'values'")

        kwargs = {
            'values': [
                v and SingleException.to_python(
                    v, slim_frames=False, rust_renormalized=rust_renormalized)
                for v in values
            ],
        }

        if not rust_renormalized:
            if data.get('exc_omitted'):
                if len(data['exc_omitted']) != 2:
                    raise InterfaceValidationError("Invalid value for 'exc_omitted'")
                kwargs['exc_omitted'] = data['exc_omitted']
            else:
                kwargs['exc_omitted'] = None
        else:
            kwargs.setdefault('exc_omitted', None)

        instance = cls(**kwargs)

        if not rust_renormalized:
            # we want to wait to slim things til we've reconciled in_app
            slim_exception_data(instance)

        return instance

    # TODO(ja): Fix all following methods when to_python is refactored. All
    # methods below might throw if None exceptions are in ``values``.

    def to_json(self):
        return prune_empty_keys({
            'values': [v and v.to_json() for v in self.values] or None,
            'exc_omitted': self.exc_omitted,
        })

    def get_api_context(self, is_public=False):
        return {
            'values': [v.get_api_context(is_public=is_public) for v in self.values if v],
            'hasSystemFrames':
            any(v.stacktrace.get_has_system_frames() for v in self.values if v and v.stacktrace),
            'excOmitted':
            self.exc_omitted,
        }

    def get_api_meta(self, meta, is_public=False):
        if not meta:
            return meta

        result = {}
        values = meta.get('values', meta)
        for index, value in six.iteritems(values):
            exc = self.values[int(index)]
            if exc is not None:
                result[index] = exc.get_api_meta(value, is_public=is_public)

        return {'values': result}

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

    def iter_tags(self):
        if not self.values or not self.values[0]:
            return

        mechanism = self.values[0].mechanism
        if mechanism:
            for tag in mechanism.iter_tags():
                yield tag


def slim_exception_data(instance, frame_allowance=settings.SENTRY_MAX_STACKTRACE_FRAMES):
    """
    Removes various excess metadata from middle frames which go beyond
    ``frame_allowance``.
    """
    # TODO(dcramer): it probably makes sense to prioritize a certain exception
    # rather than distributing allowance among all exceptions
    frames = []
    for exception in instance.values:
        if exception is None or not exception.stacktrace:
            continue
        frames.extend(exception.stacktrace.frames)

    slim_frame_data(frames, frame_allowance)
