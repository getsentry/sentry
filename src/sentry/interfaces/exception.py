"""
sentry.interfaces.exception
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

__all__ = ('Exception',)

from django.conf import settings

from sentry.interfaces.base import Interface
from sentry.interfaces.stacktrace import Stacktrace, is_newest_frame_first
from sentry.utils.safe import trim
from sentry.web.helpers import render_to_string


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
    >>>     "module": "__builtins__"
    >>>     "stacktrace": {
    >>>         # see sentry.interfaces.Stacktrace
    >>>     }
    >>> }
    """
    score = 900
    display_score = 1200

    @classmethod
    def to_python(cls, data):
        assert data.get('type') or data.get('value')

        if data.get('stacktrace'):
            stacktrace = Stacktrace.to_python(data['stacktrace'])
        else:
            stacktrace = None

        kwargs = {
            'type': trim(data.get('type'), 128),
            'value': trim(data.get('value'), 1024),
            'module': trim(data.get('module'), 128),
            'stacktrace': stacktrace,
        }

        return cls(**kwargs)

    def to_json(self):
        if self.stacktrace:
            stacktrace = self.stacktrace.to_json()
        else:
            stacktrace = None

        return {
            'type': self.type,
            'value': self.value,
            'module': self.module,
            'stacktrace': stacktrace,
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

    def get_context(self, event, is_public=False, **kwargs):
        last_frame = None
        interface = event.interfaces.get('sentry.interfaces.Stacktrace')
        if interface is not None and interface.frames:
            last_frame = interface.frames[-1]

        e_module = self.module
        e_type = self.type
        e_value = self.value

        if self.module:
            fullname = '%s.%s' % (e_module, e_type)
        else:
            fullname = e_type

        if e_value and not e_type:
            e_type = e_value
            e_value = None

        return {
            'is_public': is_public,
            'event': event,
            'exception_type': e_type,
            'exception_value': e_value,
            'exception_module': e_module,
            'fullname': fullname,
            'last_frame': last_frame,
        }


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
    >>>         "module": "__builtins__"
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

    @classmethod
    def to_python(cls, data):
        if 'values' not in data:
            data = {'values': [data]}

        assert data['values']

        trim_exceptions(data)

        kwargs = {
            'values': [
                SingleException.to_python(v)
                for v in data['values']
            ],
        }

        if data.get('exc_omitted'):
            assert len(data['exc_omitted']) == 2
            kwargs['exc_omitted'] = data['exc_omitted']
        else:
            kwargs['exc_omitted'] = None

        return cls(**kwargs)

    def to_json(self):
        return {
            'values': [v.to_json() for v in self.values],
            'exc_omitted': self.exc_omitted,
        }

    def __getitem__(self, key):
        return self.values[key]

    def __iter__(self):
        return iter(self.values)

    def __len__(self):
        return len(self.values)

    def get_alias(self):
        return 'exception'

    def get_path(self):
        return 'sentry.interfaces.Exception'

    def compute_hashes(self):
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

    def get_context(self, event, is_public=False, **kwargs):
        newest_first = is_newest_frame_first(event)
        context_kwargs = {
            'event': event,
            'is_public': is_public,
            'newest_first': newest_first,
        }

        exceptions = []
        last = len(self.values) - 1
        for num, e in enumerate(self.values):
            context = e.get_context(**context_kwargs)
            if e.stacktrace:
                context['stacktrace'] = e.stacktrace.get_context(
                    with_stacktrace=False, **context_kwargs)
            else:
                context['stacktrace'] = {}
            context['stack_id'] = 'exception_%d' % (num,)
            context['is_root'] = num == last
            exceptions.append(context)

        if newest_first:
            exceptions.reverse()

        if self.exc_omitted:
            first_exc_omitted, last_exc_omitted = self.exc_omitted
        else:
            first_exc_omitted, last_exc_omitted = None, None

        return {
            'newest_first': newest_first,
            'system_frames': sum(e['stacktrace'].get('system_frames', 0) for e in exceptions),
            'exceptions': exceptions,
            'stacktrace': self.get_stacktrace(event, newest_first=newest_first),
            'first_exc_omitted': first_exc_omitted,
            'last_exc_omitted': last_exc_omitted,
        }

    def to_html(self, event, **kwargs):
        if not self.values:
            return ''

        if len(self.values) == 1 and not self.values[0].stacktrace:
            exception = self.values[0]
            context = exception.get_context(event=event, **kwargs)
            return render_to_string('sentry/partial/interfaces/exception.html', context)

        context = self.get_context(event=event, **kwargs)
        return render_to_string('sentry/partial/interfaces/chained_exception.html', context)

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


def trim_exceptions(data, max_values=settings.SENTRY_MAX_EXCEPTIONS):
    # TODO: this doesnt account for cases where the client has already omitted
    # exceptions
    values = data['values']
    exc_len = len(values)

    if exc_len <= max_values:
        return

    half_max = max_values / 2

    data['exc_omitted'] = (half_max, exc_len - half_max)

    for n in xrange(half_max, exc_len - half_max):
        del values[half_max]
