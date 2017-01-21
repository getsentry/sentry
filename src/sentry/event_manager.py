"""
sentry.event_manager
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging
import math
import six

from datetime import datetime, timedelta
from collections import OrderedDict
from django.conf import settings
from django.db import connection, IntegrityError, router, transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.encoding import force_bytes, force_text
from hashlib import md5
from uuid import uuid4

from sentry import eventtypes
from sentry.app import buffer, tsdb
from sentry.constants import (
    CLIENT_RESERVED_ATTRS, LOG_LEVELS, DEFAULT_LOGGER_NAME, MAX_CULPRIT_LENGTH
)
from sentry.interfaces.base import get_interface
from sentry.models import (
    Activity, Environment, Event, EventMapping, EventUser, Group, GroupHash,
    GroupRelease, GroupResolution, GroupStatus, Project, Release,
    ReleaseEnvironment, TagKey, UserReport
)
from sentry.plugins import plugins
from sentry.signals import first_event_received, regression_signal
from sentry.tasks.merge import merge_group
from sentry.tasks.post_process import post_process_group
from sentry.utils.cache import default_cache
from sentry.utils.db import get_db_engine
from sentry.utils.hashlib import md5_text
from sentry.utils.safe import safe_execute, trim, trim_dict
from sentry.utils.strings import truncatechars
from sentry.utils.validators import validate_ip


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
    return ('message', [event.message])


def get_grouping_behavior(event):
    data = event.data
    if 'checksum' in data:
        return ('checksum', data['checksum'])
    fingerprint = get_fingerprint_for_event(event)
    return ('fingerprint', get_hashes_from_fingerprint_with_reason(event, fingerprint))


def get_hashes_from_fingerprint(event, fingerprint):
    default_values = set(['{{ default }}', '{{default}}'])
    if any(d in fingerprint for d in default_values):
        default_hashes = get_hashes_for_event(event)
        hash_count = len(default_hashes)
    else:
        hash_count = 1

    hashes = []
    for idx in range(hash_count):
        result = []
        for bit in fingerprint:
            if bit in default_values:
                result.extend(default_hashes[idx])
            else:
                result.append(bit)
        hashes.append(result)
    return hashes


def get_hashes_from_fingerprint_with_reason(event, fingerprint):
    default_values = set(['{{ default }}', '{{default}}'])
    if any(d in fingerprint for d in default_values):
        default_hashes = get_hashes_for_event_with_reason(event)
        hash_count = len(default_hashes[1])
    else:
        hash_count = 1

    hashes = OrderedDict((bit, []) for bit in fingerprint)
    for idx in range(hash_count):
        for bit in fingerprint:
            if bit in default_values:
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
            e['stacktrace']
            for e in data['sentry.interfaces.Exception']['values']
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
        result = safe_execute(plugin.is_regression, group, event,
                              version=1, _with_transaction=False)
        if result is not None:
            return result
    return True


class ScoreClause(object):
    def __init__(self, group):
        self.group = group

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


class EventManager(object):
    logger = logging.getLogger('sentry.events')

    def __init__(self, data, version='5'):
        self.data = data
        self.version = version

    def normalize(self):
        # TODO(dcramer): store http.env.REMOTE_ADDR as user.ip
        # First we pull out our top-level (non-data attr) kwargs
        data = self.data

        if not isinstance(data.get('level'), (six.string_types, int)):
            data['level'] = logging.ERROR
        elif data['level'] not in LOG_LEVELS:
            data['level'] = logging.ERROR

        if not data.get('logger'):
            data['logger'] = DEFAULT_LOGGER_NAME
        else:
            logger = trim(data['logger'].strip(), 64)
            if TagKey.is_valid_key(logger):
                data['logger'] = logger
            else:
                data['logger'] = DEFAULT_LOGGER_NAME

        if data.get('platform'):
            data['platform'] = trim(data['platform'], 64)

        current_timestamp = timezone.now()
        timestamp = data.get('timestamp')
        if not timestamp:
            timestamp = current_timestamp

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

        if not data.get('event_id'):
            data['event_id'] = uuid4().hex

        data.setdefault('culprit', None)
        data.setdefault('server_name', None)
        data.setdefault('site', None)
        data.setdefault('checksum', None)
        data.setdefault('fingerprint', None)
        data.setdefault('platform', None)
        data.setdefault('environment', None)
        data.setdefault('extra', {})
        data.setdefault('errors', [])

        tags = data.get('tags')
        if not tags:
            tags = []
        # full support for dict syntax
        elif isinstance(tags, dict):
            tags = list(tags.items())
        # prevent [tag, tag, tag] (invalid) syntax
        elif not all(len(t) == 2 for t in tags):
            tags = []
        else:
            tags = list(tags)

        data['tags'] = []
        for key, value in tags:
            key = six.text_type(key).strip()
            value = six.text_type(value).strip()
            if not (key and value):
                continue

            # XXX(dcramer): many legacy apps are using the environment tag
            # rather than the key itself
            if key == 'environment' and not data.get('environment'):
                data['environment'] = value
            else:
                data['tags'].append((key, value))

        if not isinstance(data['extra'], dict):
            # throw it away
            data['extra'] = {}

        trim_dict(
            data['extra'], max_size=settings.SENTRY_MAX_EXTRA_VARIABLE_SIZE)

        # TODO(dcramer): more of validate data needs stuffed into the manager
        for key in list(iter(data)):
            if key in CLIENT_RESERVED_ATTRS:
                continue

            value = data.pop(key)

            try:
                interface = get_interface(key)()
            except ValueError:
                continue

            try:
                inst = interface.to_python(value)
                data[inst.get_path()] = inst.to_json()
            except Exception:
                # XXX: we should consider logging this.
                pass

        # TODO(dcramer): this logic is duplicated in ``validate_data`` from
        # coreapi

        # message is coerced to an interface, as its used for pure
        # index of searchable strings
        # See GH-3248
        message = data.pop('message', None)
        if message:
            if 'sentry.interfaces.Message' not in data:
                interface = get_interface('sentry.interfaces.Message')
                try:
                    inst = interface.to_python({
                        'message': message,
                    })
                    data[inst.get_path()] = inst.to_json()
                except Exception:
                    pass
            elif not data['sentry.interfaces.Message'].get('formatted'):
                interface = get_interface('sentry.interfaces.Message')
                try:
                    inst = interface.to_python(dict(
                        data['sentry.interfaces.Message'],
                        formatted=message,
                    ))
                    data[inst.get_path()] = inst.to_json()
                except Exception:
                    pass

        # the SDKs currently do not describe event types, and we must infer
        # them from available attributes
        data['type'] = eventtypes.infer(data).key

        data['version'] = self.version

        # TODO(dcramer): find a better place for this logic
        exception = data.get('sentry.interfaces.Exception')
        stacktrace = data.get('sentry.interfaces.Stacktrace')
        if exception and len(exception['values']) == 1 and stacktrace:
            exception['values'][0]['stacktrace'] = stacktrace
            del data['sentry.interfaces.Stacktrace']

        if 'sentry.interfaces.Http' in data:
            try:
                ip_address = validate_ip(
                    data['sentry.interfaces.Http'].get(
                        'env', {}).get('REMOTE_ADDR'),
                    required=False,
                )
            except ValueError:
                ip_address = None
            if ip_address:
                data.setdefault('sentry.interfaces.User', {})
                data['sentry.interfaces.User'].setdefault(
                    'ip_address', ip_address)

        if data['culprit']:
            data['culprit'] = trim(data['culprit'], MAX_CULPRIT_LENGTH)

        return data

    def save(self, project, raw=False):
        from sentry.tasks.post_process import index_event_tags

        project = Project.objects.get_from_cache(id=project)

        data = self.data.copy()

        # First we pull out our top-level (non-data attr) kwargs
        event_id = data.pop('event_id')
        level = data.pop('level')

        culprit = data.pop('culprit', None)
        logger_name = data.pop('logger', None)
        server_name = data.pop('server_name', None)
        site = data.pop('site', None)
        checksum = data.pop('checksum', None)
        fingerprint = data.pop('fingerprint', None)
        platform = data.pop('platform', None)
        release = data.pop('release', None)
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

        date = datetime.fromtimestamp(data.pop('timestamp'))
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
            tags['sentry:release'] = release

        event_user = self._get_event_user(project, data)
        if event_user:
            # dont allow a conflicting 'user' tag
            if 'user' in tags:
                del tags['user']
            tags['sentry:user'] = event_user.tag_value

        for plugin in plugins.for_project(project, version=None):
            added_tags = safe_execute(plugin.get_tags, event,
                                      _with_transaction=False)
            if added_tags:
                # plugins should not override user provided tags
                for key, value in added_tags:
                    tags.setdefault(key, value)

        # tags are stored as a tuple
        tags = tags.items()

        # XXX(dcramer): we're relying on mutation of the data object to ensure
        # this propagates into Event
        data['tags'] = tags

        data['fingerprint'] = fingerprint or ['{{ default }}']

        for path, iface in six.iteritems(event.interfaces):
            data['tags'].extend(iface.iter_tags())
            # Get rid of ephemeral interface data
            if iface.ephemeral:
                data.pop(iface.get_path(), None)

        # prioritize fingerprint over checksum as its likely the client defaulted
        # a checksum whereas the fingerprint was explicit
        if fingerprint:
            hashes = [
                md5_from_hash(h)
                for h in get_hashes_from_fingerprint(event, fingerprint)
            ]
        elif checksum:
            hashes = [checksum]
            data['checksum'] = checksum
        else:
            hashes = [
                md5_from_hash(h)
                for h in get_hashes_for_event(event)
            ]

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

        group_kwargs = kwargs.copy()
        group_kwargs.update({
            'culprit': culprit,
            'logger': logger_name,
            'level': level,
            'last_seen': date,
            'first_seen': date,
            'active_at': date,
            'data': {
                'last_received': event.data.get('received') or float(event.datetime.strftime('%s')),
                'type': event_type.key,
                # we cache the events metadata on the group to ensure its
                # accessible in the stream
                'metadata': event_metadata,
            },
        })

        if release:
            release = Release.get_or_create(
                project=project,
                version=release,
                date_added=date,
            )

            group_kwargs['first_release'] = release

        group, is_new, is_regression, is_sample = self._save_aggregate(
            event=event,
            hashes=hashes,
            release=release,
            **group_kwargs
        )

        event.group = group
        # store a reference to the group id to guarantee validation of isolation
        event.data.bind_ref(event)

        try:
            with transaction.atomic(using=router.db_for_write(EventMapping)):
                EventMapping.objects.create(
                    project=project, group=group, event_id=event_id)
        except IntegrityError:
            self.logger.info('duplicate.found', exc_info=True, extra={
                'event_id': event_id,
                'project_id': project.id,
                'group_id': group.id,
                'model': EventMapping.__name__,
            })
            return event

        environment = Environment.get_or_create(
            project=project,
            name=environment,
        )

        if release:
            ReleaseEnvironment.get_or_create(
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

        tsdb.incr_multi(counters, timestamp=event.datetime)

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
            project=project, event_id=event_id,
        ).update(group=group)

        # save the event unless its been sampled
        if not is_sample:
            try:
                with transaction.atomic(using=router.db_for_write(Event)):
                    event.save()
            except IntegrityError:
                self.logger.info('duplicate.found', exc_info=True, extra={
                    'event_id': event_id,
                    'project_id': project.id,
                    'group_id': group.id,
                    'model': Event.__name__,
                })
                return event

            index_event_tags.delay(
                project_id=project.id,
                group_id=group.id,
                event_id=event.id,
                tags=tags,
            )

        if event_user:
            tsdb.record_multi((
                (tsdb.models.users_affected_by_group, group.id, (event_user.tag_value,)),
                (tsdb.models.users_affected_by_project, project.id, (event_user.tag_value,)),
            ), timestamp=event.datetime)

        if is_new and release:
            buffer.incr(Release, {'new_groups': 1}, {
                'id': release.id,
            })

        safe_execute(Group.objects.add_tags, group, tags,
                     _with_transaction=False)

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
            )
        else:
            self.logger.info('post_process.skip.raw_event', extra={'event_id': event.id})

        # TODO: move this to the queue
        if is_regression and not raw:
            regression_signal.send_robust(sender=Group, instance=group)

        return event

    def _get_event_user(self, project, data):
        user_data = data.get('sentry.interfaces.User')
        if not user_data:
            return

        euser = EventUser(
            project=project,
            ident=user_data.get('id'),
            email=user_data.get('email'),
            username=user_data.get('username'),
            ip_address=user_data.get('ip_address'),
        )

        if not euser.tag_value:
            return

        cache_key = 'euser:{}:{}'.format(
            project.id,
            md5_text(euser.tag_value).hexdigest(),
        )
        cached = default_cache.get(cache_key)
        if cached is None:
            try:
                with transaction.atomic(using=router.db_for_write(EventUser)):
                    euser.save()
            except IntegrityError:
                pass
            default_cache.set(cache_key, '', 3600)

        return euser

    def _find_hashes(self, project, hash_list):
        matches = []
        for hash in hash_list:
            ghash, _ = GroupHash.objects.get_or_create(
                project=project,
                hash=hash,
            )
            matches.append((ghash.group_id, ghash.hash))
        return matches

    def _ensure_hashes_merged(self, group, hash_list):
        # TODO(dcramer): there is a race condition with selecting/updating
        # in that another group could take ownership of the hash
        bad_hashes = GroupHash.objects.filter(
            project=group.project,
            hash__in=hash_list,
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

        try:
            existing_group_id = six.next(h[0] for h in all_hashes if h[0])
        except StopIteration:
            existing_group_id = None

        # XXX(dcramer): this has the opportunity to create duplicate groups
        # it should be resolved by the hash merging function later but this
        # should be better tested/reviewed
        if existing_group_id is None:
            kwargs['score'] = ScoreClause.calculate(1, kwargs['last_seen'])
            with transaction.atomic():
                short_id = project.next_short_id()
                group, group_is_new = Group.objects.create(
                    project=project,
                    short_id=short_id,
                    **kwargs
                ), True
        else:
            group = Group.objects.get(id=existing_group_id)

            group_is_new = False

        # If all hashes are brand new we treat this event as new
        is_new = False
        new_hashes = [h[1] for h in all_hashes if h[0] is None]
        if new_hashes:
            affected = GroupHash.objects.filter(
                project=project,
                hash__in=new_hashes,
                group__isnull=True,
            ).update(
                group=group,
            )

            if affected != len(new_hashes):
                self._ensure_hashes_merged(group, new_hashes)
            elif group_is_new and len(new_hashes) == len(all_hashes):
                is_new = True

        # XXX(dcramer): it's important this gets called **before** the aggregate
        # is processed as otherwise values like last_seen will get mutated
        can_sample = should_sample(
            event.data.get('received') or float(event.datetime.strftime('%s')),
            group.data.get('last_received') or float(group.last_seen.strftime('%s')),
            group.times_seen,
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

        return group, is_new, is_regression, is_sample

    def _handle_regression(self, group, event, release):
        if not group.is_resolved():
            return

        elif release:
            # we only mark it as a regression if the event's release is newer than
            # the release which we originally marked this as resolved
            has_resolution = GroupResolution.objects.filter(
                Q(release__date_added__gt=release.date_added) | Q(release=release),
                group=group,
            ).exists()
            if has_resolution:
                return

        else:
            has_resolution = False

        if not plugin_is_regression(group, event):
            return

        # we now think its a regression, rely on the database to validate that
        # no one beat us to this
        date = max(event.datetime, group.last_seen)
        is_regression = bool(Group.objects.filter(
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
        ))

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
