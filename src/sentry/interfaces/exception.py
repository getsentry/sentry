"""
sentry.interfaces.exception
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

__all__ = ('Exception',)

import six

from django.conf import settings

from sentry.interfaces.base import Interface, InterfaceValidationError
from sentry.interfaces.stacktrace import Stacktrace, slim_frame_data
from sentry.utils import json
from sentry.utils.safe import trim


class SingleException(Interface):
    """
    A standard exception with a ``type`` and value argument, and an optional
    ``module`` argument describing the exception class type and
    module namespace. Either ``type`` or ``value`` must be present.

    You can also optionally bind a stacktrace interface to an exception. The
    spec is identical to ``sentry.interfaces.Stacktrace``.

    >>>  {
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

    @classmethod
    def to_python(cls, data, has_system_frames=None, slim_frames=True):
        if not (data.get('type') or data.get('value')):
            raise InterfaceValidationError("No 'type' or 'value' present")

        if data.get('stacktrace') and data['stacktrace'].get('frames'):
            stacktrace = Stacktrace.to_python(
                data['stacktrace'],
                has_system_frames=has_system_frames,
                slim_frames=slim_frames,
            )
        else:
            stacktrace = None

        if data.get('raw_stacktrace') and data['raw_stacktrace'].get('frames'):
            raw_stacktrace = Stacktrace.to_python(
                data['raw_stacktrace'],
                has_system_frames=has_system_frames,
                slim_frames=slim_frames,
            )
        else:
            raw_stacktrace = None

        type = data.get('type')
        value = data.get('value')
        if not type and ':' in value.split(' ', 1)[0]:
            type, value = value.split(':', 1)
            # in case of TypeError: foo (no space)
            value = value.strip()

        if value is not None and not isinstance(value, six.string_types):
            value = json.dumps(value)
        value = trim(value, 4096)

        mechanism = data.get('mechanism')
        if mechanism is not None:
            if not isinstance(mechanism, dict):
                raise InterfaceValidationError('Bad value for mechanism')
            mechanism = trim(data.get('mechanism'), 4096)
            mechanism.setdefault('type', 'generic')

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
            'mechanism': self.mechanism or None,
            'module': self.module,
            'stacktrace': stacktrace,
            'thread_id': self.thread_id,
            'raw_stacktrace': raw_stacktrace,
        }

    def get_api_context(self, is_public=False):
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
            'mechanism': self.mechanism or None,
            'threadId': self.thread_id,
            'module': self.module,
            'stacktrace': stacktrace,
            'rawStacktrace': raw_stacktrace,
        }

    def get_alias(self):
        return 'exception'

    def get_path(self):
        return 'sentry.interfaces.Exception'

    def get_hash(self):
        output = None
        if self.stacktrace:
            output = self.stacktrace.get_hash()
            if output and self.type:
                output.append(self.type)
        if not output:
            output = filter(bool, [self.type, self.value])
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
    >>>         "mechanism": {},
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

        has_system_frames = cls.data_has_system_frames(data)

        kwargs = {
            'values': [
                SingleException.to_python(
                    v,
                    has_system_frames=has_system_frames,
                    slim_frames=False,
                )
                for v in data['values']
            ],
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

    @classmethod
    def data_has_system_frames(cls, data):
        system_frames = 0
        app_frames = 0
        for exc in data['values']:
            if not exc.get('stacktrace'):
                continue

            frames = exc['stacktrace'].get('frames')
            if not frames:
                continue

            for frame in frames:
                # XXX(dcramer): handle PHP sending an empty array for a frame
                if not isinstance(frame, dict):
                    continue
                if frame.get('in_app') is True:
                    app_frames += 1
                else:
                    system_frames += 1

        # if there is a mix of frame styles then we indicate that system frames
        # are present and should be represented as a split
        return bool(app_frames and system_frames)

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
        system_hash = self.get_hash(system_frames=True)
        if not system_hash:
            return []

        app_hash = self.get_hash(system_frames=False)
        if system_hash == app_hash or not app_hash:
            return [system_hash]

        return [system_hash, app_hash]

    def get_hash(self, system_frames=True):
        # optimize around the fact that some exceptions might have stacktraces
        # while others may not and we ALWAYS want stacktraces over values
        output = []
        for value in self.values:
            if not value.stacktrace:
                continue
            stack_hash = value.stacktrace.get_hash(
                system_frames=system_frames,
            )
            if stack_hash:
                output.extend(stack_hash)
                output.append(value.type)

        if not output:
            for value in self.values:
                output.extend(value.get_hash())

        return output

    def get_api_context(self, is_public=False):
        return {
            'values': [
                v.get_api_context(is_public=is_public)
                for v in self.values
            ],
            'hasSystemFrames': any(
                v.stacktrace.has_system_frames
                for v in self.values
                if v.stacktrace
            ),
            'excOmitted': self.exc_omitted,
        }

    def to_string(self, event, is_public=False, **kwargs):
        if not self.values:
            return ''

        output = []
        for exc in self.values:
            output.append(u'{0}: {1}\n'.format(exc.type, exc.value))
            if exc.stacktrace:
                output.append(exc.stacktrace.get_stacktrace(
                    event, system_frames=False, max_frames=5,
                    header=False) + '\n\n')
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
