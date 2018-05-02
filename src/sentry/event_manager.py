"""
sentry.event_manager
~~~~~~~~~~~~~~~~~~~~
:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging
import math
import re
import six

from datetime import datetime, timedelta
from collections import OrderedDict
from django.conf import settings
from django.db import connection, IntegrityError, router, transaction
from django.utils import timezone
from django.utils.encoding import force_bytes, force_text
from hashlib import md5
from uuid import uuid4

from sentry import buffer, eventtypes, features, tsdb
from sentry.constants import (
    CLIENT_RESERVED_ATTRS, LOG_LEVELS, LOG_LEVELS_MAP, DEFAULT_LOG_LEVEL,
    DEFAULT_LOGGER_NAME, MAX_CULPRIT_LENGTH, VALID_PLATFORMS
)
from sentry.interfaces.base import get_interface, InterfaceValidationError
from sentry.interfaces.schemas import validate_and_default_interface
from sentry.models import (
    Activity, Environment, Event, EventError, EventMapping, EventUser, Group,
    GroupEnvironment, GroupHash, GroupRelease, GroupResolution, GroupStatus,
    Project, Release, ReleaseEnvironment, ReleaseProject, ReleaseProjectEnvironment, UserReport
)
from sentry.plugins import plugins
from sentry.signals import event_discarded, event_saved, first_event_received, regression_signal
from sentry.tasks.merge import merge_group
from sentry.tasks.post_process import post_process_group
from sentry.utils import metrics
from sentry.utils.cache import default_cache
from sentry.utils.db import get_db_engine
from sentry.utils.safe import safe_execute, trim, trim_dict, get_path
from sentry.utils.strings import truncatechars
from sentry.utils.validators import is_float
from sentry.stacktraces import normalize_in_app


HASH_RE = re.compile(r'^[0-9a-f]{32}$')
DEFAULT_FINGERPRINT_VALUES = frozenset(['{{ default }}', '{{default}}'])
ALLOWED_FUTURE_DELTA = timedelta(minutes=1)


def count_limit(count):
    # TODO: could we do something like num_to_store = max(math.sqrt(100*count)+59, 200) ?
    # ~ 150 * ((log(n) - 1.5) ^ 2 - 0.25)
    for amount, sample_rate in settings.SENTRY_SAMPLE_RATES:
        if count <= amount:
            return sample_rate
    return settings.SENTRY_MAX_SAMPLE_RATE


def time_limit(silence):  # ~ 3600 per hour
    for amount, sample_rate in settings.SENTRY_SAMPLE_TIMES:
        if silence >= amount:
            return sample_rate
    return settings.SENTRY_MAX_SAMPLE_TIME


def md5_from_hash(hash_bits):
    result = md5()
    for bit in hash_bits:
        result.update(force_bytes(bit, errors='replace'))
    return result.hexdigest()


def get_fingerprint_for_event(event):
    fingerprint = event.data.get('fingerprint')
    if fingerprint is None:
        return ['{{ default }}']
    if isinstance(fingerprint, six.string_types):
        return [fingerprint]
    return fingerprint


def get_hashes_for_event(event):
    return get_hashes_for_event_with_reason(event)[1]


def get_hashes_for_event_with_reason(event):
    interfaces = event.get_interfaces()
    for interface in six.itervalues(interfaces):
        result = interface.compute_hashes(event.platform)
        if not result:
            continue
        return (interface.get_path(), result)

    return ('no_interfaces', [''])


def get_grouping_behavior(event):
    data = event.data
    if 'checksum' in data:
        return ('checksum', data['checksum'])
    fingerprint = get_fingerprint_for_event(event)
    return ('fingerprint', get_hashes_from_fingerprint_with_reason(event, fingerprint))


def get_hashes_from_fingerprint(event, fingerprint):
    if any(d in fingerprint for d in DEFAULT_FINGERPRINT_VALUES):
        default_hashes = get_hashes_for_event(event)
        hash_count = len(default_hashes)
    else:
        hash_count = 1

    hashes = []
    for idx in range(hash_count):
        result = []
        for bit in fingerprint:
            if bit in DEFAULT_FINGERPRINT_VALUES:
                result.extend(default_hashes[idx])
            else:
                result.append(bit)
        hashes.append(result)
    return hashes


def get_hashes_from_fingerprint_with_reason(event, fingerprint):
    if any(d in fingerprint for d in DEFAULT_FINGERPRINT_VALUES):
        default_hashes = get_hashes_for_event_with_reason(event)
        hash_count = len(default_hashes[1])
    else:
        hash_count = 1

    hashes = OrderedDict((bit, []) for bit in fingerprint)
    for idx in range(hash_count):
        for bit in fingerprint:
            if bit in DEFAULT_FINGERPRINT_VALUES:
                hashes[bit].append(default_hashes)
            else:
                hashes[bit] = bit
    return list(hashes.items())


if not settings.SENTRY_SAMPLE_DATA:

    def should_sample(current_datetime, last_seen, times_seen):
        return False
else:

    def should_sample(current_datetime, last_seen, times_seen):
        silence = current_datetime - last_seen

        if times_seen % count_limit(times_seen) == 0:
            return False

        if times_seen % time_limit(silence) == 0:
            return False

        return True


def generate_culprit(data, platform=None):
    culprit = ''
    try:
        stacktraces = [
            e['stacktrace'] for e in data['sentry.interfaces.Exception']['values']
            if e.get('stacktrace')
        ]
    except KeyError:
        stacktrace = data.get('sentry.interfaces.Stacktrace')
        if stacktrace:
            stacktraces = [stacktrace]
        else:
            stacktraces = None

    if not stacktraces:
        if 'sentry.interfaces.Http' in data:
            culprit = data['sentry.interfaces.Http'].get('url', '')
    else:
        from sentry.interfaces.stacktrace import Stacktrace
        culprit = Stacktrace.to_python(stacktraces[-1]).get_culprit_string(
            platform=platform,
        )

    return truncatechars(culprit, MAX_CULPRIT_LENGTH)


def plugin_is_regression(group, event):
    project = event.project
    for plugin in plugins.for_project(project):
        result = safe_execute(
            plugin.is_regression, group, event, version=1, _with_transaction=False
        )
        if result is not None:
            return result
    return True


def process_timestamp(value, current_datetime=None):
    if is_float(value):
        try:
            value = datetime.fromtimestamp(float(value))
        except Exception:
            raise InvalidTimestamp(EventError.INVALID_DATA)
    elif not isinstance(value, datetime):
        # all timestamps are in UTC, but the marker is optional
        if value.endswith('Z'):
            value = value[:-1]
        if '.' in value:
            # Python doesn't support long microsecond values
            # https://github.com/getsentry/sentry/issues/1610
            ts_bits = value.split('.', 1)
            value = '%s.%s' % (ts_bits[0], ts_bits[1][:2])
            fmt = '%Y-%m-%dT%H:%M:%S.%f'
        else:
            fmt = '%Y-%m-%dT%H:%M:%S'
        try:
            value = datetime.strptime(value, fmt)
        except Exception:
            raise InvalidTimestamp(EventError.INVALID_DATA)

    if current_datetime is None:
        current_datetime = datetime.now()

    if value > current_datetime + ALLOWED_FUTURE_DELTA:
        raise InvalidTimestamp(EventError.FUTURE_TIMESTAMP)

    if value < current_datetime - timedelta(days=30):
        raise InvalidTimestamp(EventError.PAST_TIMESTAMP)

    return float(value.strftime('%s'))


class HashDiscarded(Exception):
    pass


try:
    from django.db.models import Func
except ImportError:
    # XXX(dramer): compatibility hack for Django 1.6
    class ScoreClause(object):
        def __init__(self, group, *args, **kwargs):
            self.group = group
            super(ScoreClause, self).__init__(*args, **kwargs)

        def __int__(self):
            # Calculate the score manually when coercing to an int.
            # This is used within create_or_update and friends
            return self.group.get_score()

        def prepare_database_save(self, unused):
            return self

        def prepare(self, evaluator, query, allow_joins):
            return

        def evaluate(self, node, qn, connection):
            engine = get_db_engine(getattr(connection, 'alias', 'default'))
            if engine.startswith('postgresql'):
                sql = 'log(times_seen) * 600 + last_seen::abstime::int'
            elif engine.startswith('mysql'):
                sql = 'log(times_seen) * 600 + unix_timestamp(last_seen)'
            else:
                # XXX: if we cant do it atomically let's do it the best we can
                sql = int(self)

            return (sql, [])

        @classmethod
        def calculate(cls, times_seen, last_seen):
            return math.log(times_seen) * 600 + float(last_seen.strftime('%s'))
else:
    # XXX(dramer): compatibility hack for Django 1.8+
    class ScoreClause(Func):
        def __init__(self, group, *args, **kwargs):
            self.group = group
            super(ScoreClause, self).__init__(*args, **kwargs)

        def __int__(self):
            # Calculate the score manually when coercing to an int.
            # This is used within create_or_update and friends
            return self.group.get_score()

        def as_sql(self, compiler, connection, function=None, template=None):
            engine = get_db_engine(getattr(connection, 'alias', 'default'))
            if engine.startswith('postgresql'):
                sql = 'log(times_seen) * 600 + last_seen::abstime::int'
            elif engine.startswith('mysql'):
                sql = 'log(times_seen) * 600 + unix_timestamp(last_seen)'
            else:
                # XXX: if we cant do it atomically let's do it the best we can
                sql = int(self)

            return (sql, [])

        @classmethod
        def calculate(cls, times_seen, last_seen):
            return math.log(times_seen) * 600 + float(last_seen.strftime('%s'))


class InvalidTimestamp(Exception):
    pass


class EventManager(object):
    logger = logging.getLogger('sentry.events')

    def __init__(self, data, version='5'):
        self.data = data
        self.version = version

    def normalize(self, request_env=None):
        request_env = request_env or {}
        data = self.data
        errors = data['errors'] = []

        # Before validating with a schema, attempt to cast values to their desired types
        # so that the schema doesn't have to take every type variation into account.
        text = six.text_type
        fp_types = six.string_types + six.integer_types + (float, )

        def to_values(v):
            return {'values': v} if v and isinstance(v, (tuple, list)) else v

        casts = {
            'environment': lambda v: text(v) if v is not None else v,
            'fingerprint': lambda v: list(map(text, v)) if isinstance(v, list) and all(isinstance(f, fp_types) for f in v) else v,
            'release': lambda v: text(v) if v is not None else v,
            'dist': lambda v: text(v).strip() if v is not None else v,
            'time_spent': lambda v: int(v) if v is not None else v,
            'tags': lambda v: [(text(v_k).replace(' ', '-').strip(), text(v_v).strip()) for (v_k, v_v) in dict(v).items()],
            'timestamp': lambda v: process_timestamp(v),
            'platform': lambda v: v if v in VALID_PLATFORMS else 'other',
            'sentry.interfaces.Message': lambda v: v if isinstance(v, dict) else {'message': v},

            # These can be sent as lists and need to be converted to {'values': [...]}
            'exception': to_values,
            'sentry.interfaces.Exception': to_values,
            'breadcrumbs': to_values,
            'sentry.interfaces.Breadcrumbs': to_values,
            'threads': to_values,
            'sentry.interfaces.Threads': to_values,
        }

        for c in casts:
            if c in data:
                try:
                    data[c] = casts[c](data[c])
                except InvalidTimestamp as it:
                    errors.append({'type': it.args[0], 'name': c, 'value': data[c]})
                    del data[c]
                except Exception as e:
                    errors.append({'type': EventError.INVALID_DATA, 'name': c, 'value': data[c]})
                    del data[c]

        # raw 'message' is coerced to the Message interface, as its used for pure index of
        # searchable strings. If both a raw 'message' and a Message interface exist, try and
        # add the former as the 'formatted' attribute of the latter.
        # See GH-3248
        msg_str = data.pop('message', None)
        if msg_str:
            msg_if = data.setdefault('sentry.interfaces.Message', {'message': msg_str})
            if msg_if.get('message') != msg_str:
                msg_if.setdefault('formatted', msg_str)

        # Fill in ip addresses marked as {{auto}}
        client_ip = request_env.get('client_ip')
        if client_ip:
            if get_path(data, ['sentry.interfaces.Http', 'env', 'REMOTE_ADDR']) == '{{auto}}':
                data['sentry.interfaces.Http']['env']['REMOTE_ADDR'] = client_ip

            if get_path(data, ['request', 'env', 'REMOTE_ADDR']) == '{{auto}}':
                data['request']['env']['REMOTE_ADDR'] = client_ip

            if get_path(data, ['sentry.interfaces.User', 'ip_address']) == '{{auto}}':
                data['sentry.interfaces.User']['ip_address'] = client_ip

            if get_path(data, ['user', 'ip_address']) == '{{auto}}':
                data['user']['ip_address'] = client_ip

        # Validate main event body and tags against schema
        is_valid, event_errors = validate_and_default_interface(data, 'event')
        errors.extend(event_errors)
        if 'tags' in data:
            is_valid, tag_errors = validate_and_default_interface(data['tags'], 'tags', name='tags')
            errors.extend(tag_errors)

        # Validate interfaces
        for k in list(iter(data)):
            if k in CLIENT_RESERVED_ATTRS:
                continue

            value = data.pop(k)

            if not value:
                self.logger.debug('Ignored empty interface value: %s', k)
                continue

            try:
                interface = get_interface(k)
            except ValueError:
                self.logger.debug('Ignored unknown attribute: %s', k)
                errors.append({'type': EventError.INVALID_ATTRIBUTE, 'name': k})
                continue

            try:
                inst = interface.to_python(value)
                data[inst.get_path()] = inst.to_json()
            except Exception as e:
                log = self.logger.debug if isinstance(
                    e, InterfaceValidationError) else self.logger.error
                log('Discarded invalid value for interface: %s (%r)', k, value, exc_info=True)
                errors.append({'type': EventError.INVALID_DATA, 'name': k, 'value': value})

        # Additional data coercion and defaulting
        level = data.get('level') or DEFAULT_LOG_LEVEL
        if isinstance(level, int) or (isinstance(level, six.string_types) and level.isdigit()):
            level = LOG_LEVELS.get(int(level), DEFAULT_LOG_LEVEL)
        data['level'] = LOG_LEVELS_MAP.get(level, LOG_LEVELS_MAP[DEFAULT_LOG_LEVEL])

        if data.get('dist') and not data.get('release'):
            data['dist'] = None

        timestamp = data.get('timestamp')
        if not timestamp:
            timestamp = timezone.now()

        # TODO (alex) can this all be replaced by utcnow?
        # it looks like the only time that this would even be hit is when timestamp
        # is not defined, as the earlier process_timestamp already converts existing
        # timestamps to floats.
        if isinstance(timestamp, datetime):
            # We must convert date to local time so Django doesn't mess it up
            # based on TIME_ZONE
            if settings.TIME_ZONE:
                if not timezone.is_aware(timestamp):
                    timestamp = timestamp.replace(tzinfo=timezone.utc)
            elif timezone.is_aware(timestamp):
                timestamp = timestamp.replace(tzinfo=None)
            timestamp = float(timestamp.strftime('%s'))

        data['timestamp'] = timestamp
        data['received'] = float(timezone.now().strftime('%s'))

        data.setdefault('checksum', None)
        data.setdefault('culprit', None)
        data.setdefault('dist', None)
        data.setdefault('environment', None)
        data.setdefault('extra', {})
        data.setdefault('fingerprint', None)
        data.setdefault('logger', DEFAULT_LOGGER_NAME)
        data.setdefault('platform', None)
        data.setdefault('server_name', None)
        data.setdefault('site', None)
        data.setdefault('tags', [])
        data.setdefault('transaction', None)

        # Fix case where legacy apps pass 'environment' as a tag
        # instead of a top level key.
        # TODO (alex) save() just reinserts the environment into the tags
        if not data.get('environment'):
            tagsdict = dict(data['tags'])
            if 'environment' in tagsdict:
                data['environment'] = tagsdict['environment']
                del tagsdict['environment']
                data['tags'] = tagsdict.items()

        # the SDKs currently do not describe event types, and we must infer
        # them from available attributes
        data['type'] = eventtypes.infer(data).key
        data['version'] = self.version

        exception = data.get('sentry.interfaces.Exception')
        stacktrace = data.get('sentry.interfaces.Stacktrace')
        if exception and len(exception['values']) == 1 and stacktrace:
            exception['values'][0]['stacktrace'] = stacktrace
            del data['sentry.interfaces.Stacktrace']

        # If there is no User ip_addres, update it either from the Http interface
        # or the client_ip of the request.
        auth = request_env.get('auth')
        is_public = auth and auth.is_public
        add_ip_platforms = ('javascript', 'cocoa', 'objc')

        http_ip = data.get('sentry.interfaces.Http', {}).get('env', {}).get('REMOTE_ADDR')
        if http_ip:
            data.setdefault('sentry.interfaces.User', {}).setdefault('ip_address', http_ip)
        elif client_ip and (is_public or data.get('platform') in add_ip_platforms):
            data.setdefault('sentry.interfaces.User', {}).setdefault('ip_address', client_ip)

        if client_ip and data.get('sdk'):
            data['sdk']['client_ip'] = client_ip

        # Trim values
        data['logger'] = trim(data['logger'].strip(), 64)
        trim_dict(data['extra'], max_size=settings.SENTRY_MAX_EXTRA_VARIABLE_SIZE)

        if data['culprit']:
            data['culprit'] = trim(data['culprit'], MAX_CULPRIT_LENGTH)

        if data['transaction']:
            data['transaction'] = trim(data['transaction'], MAX_CULPRIT_LENGTH)

        return data

    def save(self, project, raw=False):
        from sentry.tasks.post_process import index_event_tags

        project = Project.objects.get_from_cache(id=project)

        # Check to make sure we're not about to do a bunch of work that's
        # already been done if we've processed an event with this ID. (This
        # isn't a perfect solution -- this doesn't handle ``EventMapping`` and
        # there's a race condition between here and when the event is actually
        # saved, but it's an improvement. See GH-7677.)
        try:
            event = Event.objects.get(
                project_id=project.id,
                event_id=self.data['event_id'],
            )
        except Event.DoesNotExist:
            pass
        else:
            self.logger.info(
                'duplicate.found',
                exc_info=True,
                extra={
                    'event_uuid': self.data['event_id'],
                    'project_id': project.id,
                    'model': Event.__name__,
                }
            )
            return event

        data = self.data.copy()

        # First we pull out our top-level (non-data attr) kwargs
        event_id = data.pop('event_id')
        level = data.pop('level')
        culprit = data.pop('transaction', None)
        if not culprit:
            culprit = data.pop('culprit', None)
        logger_name = data.pop('logger', None)
        server_name = data.pop('server_name', None)
        site = data.pop('site', None)
        checksum = data.pop('checksum', None)
        fingerprint = data.pop('fingerprint', None)
        platform = data.pop('platform', None)
        release = data.pop('release', None)
        dist = data.pop('dist', None)
        environment = data.pop('environment', None)

        # unused
        time_spent = data.pop('time_spent', None)
        message = data.pop('message', '')

        if not culprit:
            # if we generate an implicit culprit, lets not call it a
            # transaction
            transaction_name = None
            culprit = generate_culprit(data, platform=platform)
        else:
            transaction_name = culprit

        culprit = force_text(culprit)

        recorded_timestamp = data.pop('timestamp')
        date = datetime.fromtimestamp(recorded_timestamp)
        date = date.replace(tzinfo=timezone.utc)

        kwargs = {
            'platform': platform,
        }

        event = Event(
            project_id=project.id,
            event_id=event_id,
            data=data,
            time_spent=time_spent,
            datetime=date,
            **kwargs
        )
        event._project_cache = project

        # convert this to a dict to ensure we're only storing one value per key
        # as most parts of Sentry dont currently play well with multiple values
        tags = dict(data.get('tags') or [])
        tags['level'] = LOG_LEVELS[level]
        if logger_name:
            tags['logger'] = logger_name
        if server_name:
            tags['server_name'] = server_name
        if site:
            tags['site'] = site
        if environment:
            tags['environment'] = environment
        if transaction_name:
            tags['transaction'] = transaction_name

        if release:
            # dont allow a conflicting 'release' tag
            if 'release' in tags:
                del tags['release']
            release = Release.get_or_create(
                project=project,
                version=release,
                date_added=date,
            )

            tags['sentry:release'] = release.version

        if dist and release:
            dist = release.add_dist(dist, date)
            tags['sentry:dist'] = dist.name
        else:
            dist = None

        event_user = self._get_event_user(project, data)
        if event_user:
            # dont allow a conflicting 'user' tag
            if 'user' in tags:
                del tags['user']
            tags['sentry:user'] = event_user.tag_value

        # At this point we want to normalize the in_app values in case the
        # clients did not set this appropriately so far.
        normalize_in_app(data)

        for plugin in plugins.for_project(project, version=None):
            added_tags = safe_execute(plugin.get_tags, event, _with_transaction=False)
            if added_tags:
                # plugins should not override user provided tags
                for key, value in added_tags:
                    tags.setdefault(key, value)

        for path, iface in six.iteritems(event.interfaces):
            for k, v in iface.iter_tags():
                tags[k] = v
            # Get rid of ephemeral interface data
            if iface.ephemeral:
                data.pop(iface.get_path(), None)

        # tags are stored as a tuple
        tags = tags.items()

        # XXX(dcramer): we're relying on mutation of the data object to ensure
        # this propagates into Event
        data['tags'] = tags

        data['fingerprint'] = fingerprint or ['{{ default }}']

        # prioritize fingerprint over checksum as its likely the client defaulted
        # a checksum whereas the fingerprint was explicit
        if fingerprint:
            hashes = [md5_from_hash(h) for h in get_hashes_from_fingerprint(event, fingerprint)]
        elif checksum:
            if HASH_RE.match(checksum):
                hashes = [checksum]
            else:
                hashes = [md5_from_hash([checksum]), checksum]
            data['checksum'] = checksum
        else:
            hashes = [md5_from_hash(h) for h in get_hashes_for_event(event)]

        # TODO(dcramer): temp workaround for complexity
        data['message'] = message
        event_type = eventtypes.get(data.get('type', 'default'))(data)
        event_metadata = event_type.get_metadata()
        # TODO(dcramer): temp workaround for complexity
        del data['message']

        data['type'] = event_type.key
        data['metadata'] = event_metadata

        # index components into ``Event.message``
        # See GH-3248
        if event_type.key != 'default':
            if 'sentry.interfaces.Message' in data and \
                    data['sentry.interfaces.Message']['message'] != message:
                message = u'{} {}'.format(
                    message,
                    data['sentry.interfaces.Message']['message'],
                )

        if not message:
            message = ''
        elif not isinstance(message, six.string_types):
            message = force_text(message)

        for value in six.itervalues(event_metadata):
            value_u = force_text(value, errors='replace')
            if value_u not in message:
                message = u'{} {}'.format(message, value_u)

        if culprit and culprit not in message:
            culprit_u = force_text(culprit, errors='replace')
            message = u'{} {}'.format(message, culprit_u)

        message = trim(message.strip(), settings.SENTRY_MAX_MESSAGE_LENGTH)

        event.message = message
        kwargs['message'] = message

        received_timestamp = event.data.get('received') or float(event.datetime.strftime('%s'))
        group_kwargs = kwargs.copy()
        group_kwargs.update(
            {
                'culprit': culprit,
                'logger': logger_name,
                'level': level,
                'last_seen': date,
                'first_seen': date,
                'active_at': date,
                'data': {
                    'last_received': received_timestamp,
                    'type':
                    event_type.key,
                    # we cache the events metadata on the group to ensure its
                    # accessible in the stream
                    'metadata':
                    event_metadata,
                },
            }
        )

        if release:
            group_kwargs['first_release'] = release

        try:
            group, is_new, is_regression, is_sample = self._save_aggregate(
                event=event, hashes=hashes, release=release, **group_kwargs
            )
        except HashDiscarded:
            event_discarded.send_robust(
                project=project,
                sender=EventManager,
            )

            metrics.incr(
                'events.discarded',
                skip_internal=True,
                tags={
                    'organization_id': project.organization_id,
                    'platform': platform,
                },
            )
            raise
        else:
            event_saved.send_robust(
                project=project,
                sender=EventManager,
            )

        event.group = group
        # store a reference to the group id to guarantee validation of isolation
        event.data.bind_ref(event)

        # When an event was sampled, the canonical source of truth
        # is the EventMapping table since we aren't going to be writing out an actual
        # Event row. Otherwise, if the Event isn't being sampled, we can safely
        # rely on the Event table itself as the source of truth and ignore
        # EventMapping since it's redundant information.
        if is_sample:
            try:
                with transaction.atomic(using=router.db_for_write(EventMapping)):
                    EventMapping.objects.create(project=project, group=group, event_id=event_id)
            except IntegrityError:
                self.logger.info(
                    'duplicate.found',
                    exc_info=True,
                    extra={
                        'event_uuid': event_id,
                        'project_id': project.id,
                        'group_id': group.id,
                        'model': EventMapping.__name__,
                    }
                )
                return event

        environment = Environment.get_or_create(
            project=project,
            name=environment,
        )

        group_environment, is_new_group_environment = GroupEnvironment.get_or_create(
            group_id=group.id,
            environment_id=environment.id,
            defaults={
                'first_release_id': release.id if release else None,
            },
        )

        if release:
            ReleaseEnvironment.get_or_create(
                project=project,
                release=release,
                environment=environment,
                datetime=date,
            )

            ReleaseProjectEnvironment.get_or_create(
                project=project,
                release=release,
                environment=environment,
                datetime=date,
            )

            grouprelease = GroupRelease.get_or_create(
                group=group,
                release=release,
                environment=environment,
                datetime=date,
            )

        counters = [
            (tsdb.models.group, group.id),
            (tsdb.models.project, project.id),
        ]

        if release:
            counters.append((tsdb.models.release, release.id))

        tsdb.incr_multi(counters, timestamp=event.datetime, environment_id=environment.id)

        frequencies = [
            # (tsdb.models.frequent_projects_by_organization, {
            #     project.organization_id: {
            #         project.id: 1,
            #     },
            # }),
            # (tsdb.models.frequent_issues_by_project, {
            #     project.id: {
            #         group.id: 1,
            #     },
            # })
            (tsdb.models.frequent_environments_by_group, {
                group.id: {
                    environment.id: 1,
                },
            })
        ]

        if release:
            frequencies.append(
                (tsdb.models.frequent_releases_by_group, {
                    group.id: {
                        grouprelease.id: 1,
                    },
                })
            )

        tsdb.record_frequency_multi(frequencies, timestamp=event.datetime)

        UserReport.objects.filter(
            project=project,
            event_id=event_id,
        ).update(
            group=group,
            environment=environment,
        )

        # save the event unless its been sampled
        if not is_sample:
            try:
                with transaction.atomic(using=router.db_for_write(Event)):
                    event.save()
            except IntegrityError:
                self.logger.info(
                    'duplicate.found',
                    exc_info=True,
                    extra={
                        'event_uuid': event_id,
                        'project_id': project.id,
                        'group_id': group.id,
                        'model': Event.__name__,
                    }
                )
                return event

            index_event_tags.delay(
                organization_id=project.organization_id,
                project_id=project.id,
                group_id=group.id,
                environment_id=environment.id,
                event_id=event.id,
                tags=tags,
                date_added=event.datetime,
            )

        if event_user:
            tsdb.record_multi(
                (
                    (tsdb.models.users_affected_by_group, group.id, (event_user.tag_value, )),
                    (tsdb.models.users_affected_by_project, project.id, (event_user.tag_value, )),
                ),
                timestamp=event.datetime,
                environment_id=environment.id,
            )
        if release:
            if is_new:
                buffer.incr(
                    ReleaseProject, {'new_groups': 1}, {
                        'release_id': release.id,
                        'project_id': project.id,
                    }
                )
            if is_new_group_environment:
                buffer.incr(
                    ReleaseProjectEnvironment, {'new_issues_count': 1}, {
                        'project_id': project.id,
                        'release_id': release.id,
                        'environment_id': environment.id,
                    }
                )

        safe_execute(Group.objects.add_tags, group, environment, tags, _with_transaction=False)

        if not raw:
            if not project.first_event:
                project.update(first_event=date)
                first_event_received.send(project=project, group=group, sender=Project)

            post_process_group.delay(
                group=group,
                event=event,
                is_new=is_new,
                is_sample=is_sample,
                is_regression=is_regression,
                is_new_group_environment=is_new_group_environment,
                primary_hash=hashes[0],
            )
        else:
            self.logger.info('post_process.skip.raw_event', extra={'event_id': event.id})

        # TODO: move this to the queue
        if is_regression and not raw:
            regression_signal.send_robust(sender=Group, instance=group)

        metrics.timing(
            'events.latency',
            received_timestamp - recorded_timestamp,
            tags={
                'project_id': project.id,
            },
        )

        return event

    def _get_event_user(self, project, data):
        user_data = data.get('sentry.interfaces.User')
        if not user_data:
            return

        euser = EventUser(
            project_id=project.id,
            ident=user_data.get('id'),
            email=user_data.get('email'),
            username=user_data.get('username'),
            ip_address=user_data.get('ip_address'),
            name=user_data.get('name'),
        )
        euser.set_hash()
        if not euser.hash:
            return

        cache_key = 'euserid:1:{}:{}'.format(
            project.id,
            euser.hash,
        )
        euser_id = default_cache.get(cache_key)
        if euser_id is None:
            try:
                with transaction.atomic(using=router.db_for_write(EventUser)):
                    euser.save()
            except IntegrityError:
                try:
                    euser = EventUser.objects.get(
                        project_id=project.id,
                        hash=euser.hash,
                    )
                except EventUser.DoesNotExist:
                    # why???
                    e_userid = -1
                else:
                    if euser.name != (user_data.get('name') or euser.name):
                        euser.update(
                            name=user_data['name'],
                        )
                    e_userid = euser.id
                default_cache.set(cache_key, e_userid, 3600)
        return euser

    def _find_hashes(self, project, hash_list):
        return map(
            lambda hash: GroupHash.objects.get_or_create(
                project=project,
                hash=hash,
            )[0],
            hash_list,
        )

    def _ensure_hashes_merged(self, group, hash_list):
        # TODO(dcramer): there is a race condition with selecting/updating
        # in that another group could take ownership of the hash
        # XXX: This function is currently unused, and hasn't been updated to
        # take `GroupHash.state` into account.
        bad_hashes = GroupHash.objects.filter(
            id__in=[h.id for h in hash_list],
        ).exclude(
            group=group,
        )
        if not bad_hashes:
            return

        for hash in bad_hashes:
            if hash.group_id:
                merge_group.delay(
                    from_object_id=hash.group_id,
                    to_object_id=group.id,
                    transaction_id=uuid4().hex,
                )

        return GroupHash.objects.filter(
            project=group.project,
            hash__in=[h.hash for h in bad_hashes],
        ).update(
            group=group,
        )

    def _save_aggregate(self, event, hashes, release, **kwargs):
        project = event.project

        # attempt to find a matching hash
        all_hashes = self._find_hashes(project, hashes)

        existing_group_id = None
        for h in all_hashes:
            if h.group_id is not None:
                existing_group_id = h.group_id
                break
            if h.group_tombstone_id is not None:
                raise HashDiscarded('Matches group tombstone %s' % h.group_tombstone_id)

        # XXX(dcramer): this has the opportunity to create duplicate groups
        # it should be resolved by the hash merging function later but this
        # should be better tested/reviewed
        if existing_group_id is None:
            kwargs['score'] = ScoreClause.calculate(1, kwargs['last_seen'])
            # it's possible the release was deleted between
            # when we queried for the release and now, so
            # make sure it still exists
            first_release = kwargs.pop('first_release', None)

            with transaction.atomic():
                short_id = project.next_short_id()
                group, group_is_new = Group.objects.create(
                    project=project,
                    short_id=short_id,
                    first_release_id=Release.objects.filter(
                        id=first_release.id,
                    ).values_list('id', flat=True).first() if first_release else None,
                    **kwargs
                ), True

            metrics.incr(
                'group.created',
                skip_internal=True,
                tags={'platform': event.platform or 'unknown'}
            )

        else:
            group = Group.objects.get(id=existing_group_id)

            group_is_new = False

        # If all hashes are brand new we treat this event as new
        is_new = False
        new_hashes = [h for h in all_hashes if h.group_id is None]
        if new_hashes:
            # XXX: There is a race condition here wherein another process could
            # create a new group that is associated with one of the new hashes,
            # add some event(s) to it, and then subsequently have the hash
            # "stolen" by this process. This then "orphans" those events from
            # their "siblings" in the group we've created here. We don't have a
            # way to fix this, since we can't call `_ensure_hashes_merged`
            # without filtering on `group_id` (which we can't do due to query
            # planner weirdness.) For more context, see 84c6f75a and d0e22787,
            # as well as GH-5085.
            GroupHash.objects.filter(
                id__in=[h.id for h in new_hashes],
            ).exclude(
                state=GroupHash.State.LOCKED_IN_MIGRATION,
            ).update(group=group)

            if group_is_new and len(new_hashes) == len(all_hashes):
                is_new = True

        # XXX(dcramer): it's important this gets called **before** the aggregate
        # is processed as otherwise values like last_seen will get mutated
        can_sample = (
            features.has('projects:sample-events', project=project) and should_sample(
                event.data.get('received') or float(event.datetime.strftime('%s')),
                group.data.get('last_received') or float(group.last_seen.strftime('%s')),
                group.times_seen,
            )
        )

        if not is_new:
            is_regression = self._process_existing_aggregate(
                group=group,
                event=event,
                data=kwargs,
                release=release,
            )
        else:
            is_regression = False

        # Determine if we've sampled enough data to store this event
        if is_new or is_regression:
            is_sample = False
        else:
            is_sample = can_sample

        if not is_sample:
            GroupHash.record_last_processed_event_id(
                all_hashes[0].id,
                event.event_id,
            )

        return group, is_new, is_regression, is_sample

    def _handle_regression(self, group, event, release):
        if not group.is_resolved():
            return

        # we only mark it as a regression if the event's release is newer than
        # the release which we originally marked this as resolved
        elif GroupResolution.has_resolution(group, release):
            return

        if not plugin_is_regression(group, event):
            return

        # we now think its a regression, rely on the database to validate that
        # no one beat us to this
        date = max(event.datetime, group.last_seen)
        is_regression = bool(
            Group.objects.filter(
                id=group.id,
                # ensure we cant update things if the status has been set to
                # ignored
                status__in=[GroupStatus.RESOLVED, GroupStatus.UNRESOLVED],
            ).exclude(
                # add to the regression window to account for races here
                active_at__gte=date - timedelta(seconds=5),
            ).update(
                active_at=date,
                # explicitly set last_seen here as ``is_resolved()`` looks
                # at the value
                last_seen=date,
                status=GroupStatus.UNRESOLVED
            )
        )

        group.active_at = date
        group.status = GroupStatus.UNRESOLVED

        if is_regression and release:
            # resolutions are only valid if the state of the group is still
            # resolved -- if it were to change the resolution should get removed
            try:
                resolution = GroupResolution.objects.get(
                    group=group,
                )
            except GroupResolution.DoesNotExist:
                affected = False
            else:
                cursor = connection.cursor()
                # delete() API does not return affected rows
                cursor.execute("DELETE FROM sentry_groupresolution WHERE id = %s", [resolution.id])
                affected = cursor.rowcount > 0

            if affected:
                # if we had to remove the GroupResolution (i.e. we beat the
                # the queue to handling this) then we need to also record
                # the corresponding event
                try:
                    activity = Activity.objects.filter(
                        group=group,
                        type=Activity.SET_RESOLVED_IN_RELEASE,
                        ident=resolution.id,
                    ).order_by('-datetime')[0]
                except IndexError:
                    # XXX: handle missing data, as its not overly important
                    pass
                else:
                    activity.update(data={
                        'version': release.version,
                    })

        if is_regression:
            activity = Activity.objects.create(
                project=group.project,
                group=group,
                type=Activity.SET_REGRESSION,
                data={
                    'version': release.version if release else '',
                }
            )
            activity.send_notification()

        return is_regression

    def _process_existing_aggregate(self, group, event, data, release):
        date = max(event.datetime, group.last_seen)
        extra = {
            'last_seen': date,
            'score': ScoreClause(group),
            'data': data['data'],
        }
        if event.message and event.message != group.message:
            extra['message'] = event.message
        if group.level != data['level']:
            extra['level'] = data['level']
        if group.culprit != data['culprit']:
            extra['culprit'] = data['culprit']

        is_regression = self._handle_regression(group, event, release)

        group.last_seen = extra['last_seen']

        update_kwargs = {
            'times_seen': 1,
        }

        buffer.incr(Group, update_kwargs, {
            'id': group.id,
        }, extra)

        return is_regression
