"""
sentry.event_manager
~~~~~~~~~~~~~~~~~~~~
:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging
import os
import six
import random
import jsonschema

from datetime import datetime, timedelta
from django.conf import settings
from django.db import connection, IntegrityError, router, transaction
from django.utils import timezone
from django.utils.encoding import force_text
from django.utils.functional import cached_property
from sentry import options

from sentry import buffer, eventtypes, eventstream, features, tagstore, tsdb, filters
from sentry.constants import (
    CLIENT_RESERVED_ATTRS, LOG_LEVELS, LOG_LEVELS_MAP, DEFAULT_LOG_LEVEL,
    DEFAULT_LOGGER_NAME, MAX_CULPRIT_LENGTH, VALID_PLATFORMS, MAX_TAG_VALUE_LENGTH,
    CLIENT_IGNORED_ATTRS,
)
from sentry.coreapi import (
    APIError,
    APIForbidden,
    decompress_gzip,
    decompress_deflate,
    decode_and_decompress_data,
    decode_data,
    safely_load_json_string,
)
from sentry.interfaces.base import get_interface, prune_empty_keys
from sentry.interfaces.exception import normalize_mechanism_meta
from sentry.interfaces.schemas import validate_and_default_interface
from sentry.lang.native.utils import get_sdk_from_event
from sentry.models import (
    Activity, Environment, Event, EventError, EventMapping, EventUser, Group,
    GroupEnvironment, GroupHash, GroupLink, GroupRelease, GroupResolution, GroupStatus,
    Project, Release, ReleaseEnvironment, ReleaseProject,
    ReleaseProjectEnvironment, UserReport
)
from sentry.plugins import plugins
from sentry.signals import event_discarded, event_saved, first_event_received
from sentry.tasks.integrations import kick_off_status_syncs
from sentry.utils import metrics
from sentry.utils.cache import default_cache
from sentry.utils.canonical import CanonicalKeyDict
from sentry.utils.data_filters import (
    is_valid_ip,
    is_valid_release,
    is_valid_error_message,
    FilterStatKeys,
)
from sentry.utils.dates import to_timestamp
from sentry.utils.db import is_postgres, is_mysql
from sentry.utils.meta import Meta
from sentry.utils.safe import ENABLE_TRIMMING, safe_execute, trim, trim_dict, get_path, set_path, setdefault_path
from sentry.utils.strings import truncatechars
from sentry.utils.geo import rust_geoip
from sentry.utils.validators import is_float
from sentry.utils.contexts_normalization import normalize_user_agent
from sentry.stacktraces import normalize_in_app


logger = logging.getLogger("sentry.events")


MAX_SECS_IN_FUTURE = 60
ALLOWED_FUTURE_DELTA = timedelta(seconds=MAX_SECS_IN_FUTURE)
MAX_SECS_IN_PAST = 2592000  # 30 days
SECURITY_REPORT_INTERFACES = (
    "csp",
    "hpkp",
    "expectct",
    "expectstaple",
)

ENABLE_RUST = os.environ.get("SENTRY_USE_RUST_NORMALIZER", "false").lower() in ("1", "true")


def pop_tag(data, key):
    data['tags'] = [kv for kv in data['tags'] if kv is None or kv[0] != key]


def set_tag(data, key, value):
    pop_tag(data, key)
    data['tags'].append((key, trim(value, MAX_TAG_VALUE_LENGTH)))


def get_tag(data, key):
    for k, v in get_path(data, 'tags', filter=True):
        if k == key:
            return v


def get_event_metadata_compat(data, fallback_message):
    """This is a fallback path to getting the event metadata.  This is used
    by some code paths that could potentially deal with old sentry events that
    do not have metadata yet.  This does not happen in practice any more but
    the testsuite was never adapted so the tests hit this code path constantly.
    """
    etype = data.get('type') or 'default'
    if 'metadata' not in data:
        return eventtypes.get(etype)(data).get_metadata()
    return data['metadata']


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


def parse_client_as_sdk(value):
    if not value:
        return {}
    try:
        name, version = value.split("/", 1)
    except ValueError:
        try:
            name, version = value.split(" ", 1)
        except ValueError:
            return {}
    return {"name": name, "version": version}


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
    exceptions = get_path(data, 'exception', 'values')
    if exceptions:
        stacktraces = [e['stacktrace'] for e in exceptions if get_path(e, 'stacktrace', 'frames')]
    else:
        stacktrace = data.get('stacktrace')
        if stacktrace and stacktrace.get('frames'):
            stacktraces = [stacktrace]
        else:
            stacktraces = None

    culprit = None

    if not culprit and stacktraces:
        from sentry.interfaces.stacktrace import Stacktrace
        culprit = Stacktrace.to_python(stacktraces[-1]).get_culprit_string(
            platform=platform,
        )

    if not culprit and data.get('request'):
        culprit = get_path(data, 'request', 'url')

    return truncatechars(culprit or '', MAX_CULPRIT_LENGTH)


def plugin_is_regression(group, event):
    project = event.project
    for plugin in plugins.for_project(project):
        result = safe_execute(
            plugin.is_regression, group, event, version=1, _with_transaction=False
        )
        if result is not None:
            return result
    return True


def process_timestamp(value, meta, current_datetime=None):
    original_value = value
    if value is None:
        return None

    if is_float(value):
        try:
            value = datetime.fromtimestamp(float(value))
        except Exception:
            meta.add_error(EventError.INVALID_DATA, original_value)
            return None
    elif isinstance(value, six.string_types):
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
            meta.add_error(EventError.INVALID_DATA, original_value)
            return None
    elif not isinstance(value, datetime):
        meta.add_error(EventError.INVALID_DATA, original_value)
        return None

    if current_datetime is None:
        current_datetime = datetime.now()

    if value > current_datetime + ALLOWED_FUTURE_DELTA:
        meta.add_error(EventError.FUTURE_TIMESTAMP, original_value)
        return None

    if value < current_datetime - timedelta(days=30):
        meta.add_error(EventError.PAST_TIMESTAMP, original_value)
        return None

    return float(value.strftime('%s'))


def sanitize_fingerprint(value):
    # Special case floating point values: Only permit floats that have an exact
    # integer representation in JSON to avoid rounding issues.
    if isinstance(value, float):
        return six.text_type(int(value)) if abs(value) < (1 << 53) else None

    # Stringify known types
    if isinstance(value, six.string_types + six.integer_types):
        return six.text_type(value)

    # Silently skip all other values
    return None


def cast_fingerprint(value):
    # Return incompatible values so that schema validation can emit errors
    if not isinstance(value, list):
        return value

    return list(f for f in map(sanitize_fingerprint, value) if f is not None)


def has_pending_commit_resolution(group):
    return GroupLink.objects.filter(
        group_id=group.id,
        linked_type=GroupLink.LinkedType.commit,
        relationship=GroupLink.Relationship.resolves,
    ).extra(
        where=[
            "NOT EXISTS(SELECT 1 FROM sentry_releasecommit where commit_id = sentry_grouplink.linked_id)"]
    ).exists()


class HashDiscarded(Exception):
    pass


def scoreclause_sql(sc, connection):
    db = getattr(connection, 'alias', 'default')
    has_values = sc.last_seen is not None and sc.times_seen is not None
    if is_postgres(db):
        if has_values:
            sql = 'log(times_seen + %d) * 600 + %d' % (sc.times_seen, to_timestamp(sc.last_seen))
        else:
            sql = 'log(times_seen) * 600 + last_seen::abstime::int'
    elif is_mysql(db):
        if has_values:
            sql = 'log(times_seen + %d) * 600 + %d' % (sc.times_seen, to_timestamp(sc.last_seen))
        else:
            sql = 'log(times_seen) * 600 + unix_timestamp(last_seen)'
    else:
        # XXX: if we cant do it atomically let's do it the best we can
        sql = int(sc)

    return (sql, [])


try:
    from django.db.models import Func
except ImportError:
    # XXX(dramer): compatibility hack for Django 1.6
    class ScoreClause(object):
        def __init__(self, group=None, last_seen=None, times_seen=None, *args, **kwargs):
            self.group = group
            self.last_seen = last_seen
            self.times_seen = times_seen
            # times_seen is likely an F-object that needs the value extracted
            if hasattr(self.times_seen, 'children'):
                self.times_seen = self.times_seen.children[1]
            super(ScoreClause, self).__init__(*args, **kwargs)

        def __int__(self):
            # Calculate the score manually when coercing to an int.
            # This is used within create_or_update and friends
            return self.group.get_score() if self.group else 0

        def prepare_database_save(self, unused):
            return self

        def prepare(self, evaluator, query, allow_joins):
            return

        def evaluate(self, node, qn, connection):
            return scoreclause_sql(self, connection)

else:
    # XXX(dramer): compatibility hack for Django 1.8+
    class ScoreClause(Func):
        def __init__(self, group=None, last_seen=None, times_seen=None, *args, **kwargs):
            self.group = group
            self.last_seen = last_seen
            self.times_seen = times_seen
            # times_seen is likely an F-object that needs the value extracted
            if hasattr(self.times_seen, 'rhs'):
                self.times_seen = self.times_seen.rhs.value
            super(ScoreClause, self).__init__(*args, **kwargs)

        def __int__(self):
            # Calculate the score manually when coercing to an int.
            # This is used within create_or_update and friends
            return self.group.get_score() if self.group else 0

        def as_sql(self, compiler, connection, function=None, template=None):
            return scoreclause_sql(self, connection)


def add_meta_errors(errors, meta):
    for field_meta in meta:
        original_value = field_meta.get().get('val')

        for i, (err_type, err_data) in enumerate(field_meta.iter_errors()):
            error = dict(err_data)
            error['type'] = err_type
            if field_meta.path:
                error['name'] = field_meta.path
            if i == 0 and original_value is not None:
                error['value'] = original_value
            errors.append(error)


def _decode_event(data, content_encoding):
    if isinstance(data, six.binary_type):
        if content_encoding == 'gzip':
            data = decompress_gzip(data)
        elif content_encoding == 'deflate':
            data = decompress_deflate(data)
        elif data[0] != b'{':
            data = decode_and_decompress_data(data)
        else:
            data = decode_data(data)
    if isinstance(data, six.text_type):
        data = safely_load_json_string(data)

    return CanonicalKeyDict(data)


class EventManager(object):
    """
    Handles normalization in both the store endpoint and the save task. The
    intention is to swap this class out with a reimplementation in Rust.
    """

    def __init__(
        self,
        data,
        version='5',
        project=None,
        client_ip=None,
        user_agent=None,
        auth=None,
        key=None,
        content_encoding=None,
        for_store=True,
    ):
        self._data = _decode_event(data, content_encoding=content_encoding)
        self.version = version
        self._project = project
        self._client_ip = client_ip
        self._user_agent = user_agent
        self._auth = auth
        self._key = key
        self._for_store = for_store
        self._normalized = False

    def process_csp_report(self):
        """Only called from the CSP report endpoint."""
        data = self._data

        try:
            interface = get_interface(data.pop('interface'))
            report = data.pop('report')
        except KeyError:
            raise APIForbidden('No report or interface data')

        # To support testing, we can either accept a built interface instance, or the raw data in
        # which case we build the instance ourselves
        try:
            instance = (
                report if isinstance(report, interface) else interface.from_raw(report)
            )
        except jsonschema.ValidationError as e:
            raise APIError('Invalid security report: %s' % str(e).splitlines()[0])

        def clean(d):
            return dict(filter(lambda x: x[1], d.items()))

        data.update(
            {
                'logger': 'csp',
                'message': instance.get_message(),
                'culprit': instance.get_culprit(),
                instance.path: instance.to_json(),
                'tags': instance.get_tags(),
                'errors': [],
                'user': {'ip_address': self._client_ip},
                # Construct a faux Http interface based on the little information we have
                # This is a bit weird, since we don't have nearly enough
                # information to create an Http interface, but
                # this automatically will pick up tags for the User-Agent
                # which is actually important here for CSP
                'request': {
                    'url': instance.get_origin(),
                    'headers': clean(
                        {
                            'User-Agent': self._user_agent,
                            'Referer': instance.get_referrer(),
                        }
                    ),
                },
            }
        )

        self._data = data

    @cached_property
    def use_rust_normalize(self):
        if self._project is not None:
            if self._project.id in options.get('store.projects-normalize-in-rust-opt-out'):
                return False
            if self._project.id in options.get('store.projects-normalize-in-rust-opt-in'):
                return True
            opt_in_rate = options.get('store.projects-normalize-in-rust-percent-opt-in')
            if opt_in_rate != 0:
                if opt_in_rate > 0.0:
                    bucket = ((self._project.id * 2654435761) % (2 ** 32)) % 1000
                    return bucket <= (opt_in_rate * 1000)
                else:
                    return random.random() < -opt_in_rate

        return ENABLE_RUST

    def normalize(self):
        tags = {
            'use_rust_normalize': six.text_type(self.use_rust_normalize)
        }

        with metrics.timer('events.store.normalize.duration', tags=tags):
            self._normalize_impl()

        data = self.get_data()

        data['use_rust_normalize'] = self.use_rust_normalize

        metrics.timing(
            'events.store.normalize.errors',
            len(data.get("errors") or ()),
            tags=tags,
        )

    def _normalize_impl(self):
        if self._normalized:
            raise RuntimeError('Already normalized')
        self._normalized = True

        if self.use_rust_normalize:
            from semaphore.processing import StoreNormalizer
            rust_normalizer = StoreNormalizer(
                geoip_lookup=rust_geoip,
                project_id=self._project.id if self._project else None,
                client_ip=self._client_ip,
                client=self._auth.client if self._auth else None,
                key_id=six.text_type(self._key.id) if self._key else None,
                protocol_version=six.text_type(self.version) if self.version is not None else None,
                stacktrace_frames_hard_limit=settings.SENTRY_STACKTRACE_FRAMES_HARD_LIMIT,
                max_stacktrace_frames=settings.SENTRY_MAX_STACKTRACE_FRAMES,
                valid_platforms=list(VALID_PLATFORMS),
                max_secs_in_future=MAX_SECS_IN_FUTURE,
                max_secs_in_past=MAX_SECS_IN_PAST,
                enable_trimming=ENABLE_TRIMMING,
            )

            self._data = CanonicalKeyDict(
                rust_normalizer.normalize_event(dict(self._data))
            )

            normalize_user_agent(self._data)
            return

        data = self._data

        # Before validating with a schema, attempt to cast values to their desired types
        # so that the schema doesn't have to take every type variation into account.
        text = six.text_type

        def to_values(v):
            return {'values': v} if v and isinstance(v, (tuple, list)) else v

        casts = {
            'environment': lambda v: text(v) if v is not None else v,
            'event_id': lambda v: v.lower(),
            'fingerprint': cast_fingerprint,
            'release': lambda v: text(v) if v is not None else v,
            'dist': lambda v: text(v).strip() if v is not None else v,
            'time_spent': lambda v: int(v) if v is not None else v,
            'tags': lambda v: [(text(v_k).replace(' ', '-').strip(), text(v_v).strip()) for (v_k, v_v) in dict(v).items()],
            'platform': lambda v: v if v in VALID_PLATFORMS else 'other',
            'logentry': lambda v: {'message': v} if (v and not isinstance(v, dict)) else (v or None),

            # These can be sent as lists and need to be converted to {'values': [...]}
            'exception': to_values,
            'breadcrumbs': to_values,
            'threads': to_values,
        }

        meta = Meta(data.get('_meta'))

        for c in casts:
            value = data.pop(c, None)
            if value is not None:
                try:
                    data[c] = casts[c](value)
                except Exception as e:
                    meta.enter(c).add_error(EventError.INVALID_DATA, value, {
                        'reason': six.text_type(e),
                    })

        data['timestamp'] = process_timestamp(data.get('timestamp'),
                                              meta.enter('timestamp'))

        # Fill in ip addresses marked as {{auto}}
        if self._client_ip:
            if get_path(data, 'request', 'env', 'REMOTE_ADDR') == '{{auto}}':
                data['request']['env']['REMOTE_ADDR'] = self._client_ip

            if get_path(data, 'user', 'ip_address') == '{{auto}}':
                data['user']['ip_address'] = self._client_ip

        # Validate main event body and tags against schema.
        # XXX(ja): jsonschema does not like CanonicalKeyDict, so we need to pass
        #          in the inner data dict.
        validate_and_default_interface(data.data, 'event', meta=meta)
        if data.get('tags') is not None:
            validate_and_default_interface(
                data['tags'], 'tags', name='tags', meta=meta.enter('tags'))

        # Validate interfaces
        for k in list(iter(data)):
            if k in CLIENT_RESERVED_ATTRS:
                continue

            value = data.pop(k)

            # Ignore all top-level None and empty values, regardless whether
            # they are interfaces or not. For all other unrecognized attributes,
            # we emit an explicit error, unless they are explicitly ignored.
            if not value or k in CLIENT_IGNORED_ATTRS:
                continue

            try:
                interface = get_interface(k)
            except ValueError:
                logger.debug('Ignored unknown attribute: %s', k)
                meta.enter(k).add_error(EventError.INVALID_ATTRIBUTE)
                continue

            normalized = interface.normalize(value, meta.enter(k))
            if normalized:
                data[interface.path] = normalized

        # Additional data coercion and defaulting we only do for store.
        if self._for_store:
            if self._project is not None:
                data['project'] = self._project.id
            if self._key is not None:
                data['key_id'] = self._key.id
            if self._auth is not None:
                data['sdk'] = data.get('sdk') or parse_client_as_sdk(self._auth.client)

            level = data.get('level') or DEFAULT_LOG_LEVEL
            if isinstance(level, int) or (isinstance(level, six.string_types) and level.isdigit()):
                level = LOG_LEVELS.get(int(level), DEFAULT_LOG_LEVEL)
            if level not in LOG_LEVELS_MAP:
                level = DEFAULT_LOG_LEVEL
            data['level'] = level

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

            setdefault_path(data, 'extra', value={})
            setdefault_path(data, 'logger', value=DEFAULT_LOGGER_NAME)
            setdefault_path(data, 'tags', value=[])

            # Fix case where legacy apps pass 'environment' as a tag
            # instead of a top level key.
            # TODO (alex) save() just reinserts the environment into the tags
            # TODO (markus) silly conversion between list and dict, hard to fix
            # without messing up meta
            tagsdict = dict(data['tags'])
            environment_tag = tagsdict.pop("environment", None)
            if not data.get('environment') and environment_tag:
                data['environment'] = environment_tag
            data['tags'] = tagsdict.items()

            # the SDKs currently do not describe event types, and we must infer
            # them from available attributes
            data['type'] = eventtypes.infer(data).key
            data['version'] = self.version

        exceptions = get_path(data, 'exception', 'values', filter=True)
        stacktrace = data.get('stacktrace')
        if stacktrace and exceptions and len(exceptions) == 1:
            exceptions[0]['stacktrace'] = stacktrace
            stacktrace_meta = meta.enter('stacktrace')
            meta.enter('exception', 'values', 0, 'stacktrace').merge(stacktrace_meta)
            del data['stacktrace']
            # TODO(ja): Remove meta data of data['stacktrace'] here, too

        # Exception mechanism needs SDK information to resolve proper names in
        # exception meta (such as signal names). "SDK Information" really means
        # the operating system version the event was generated on. Some
        # normalization still works without sdk_info, such as mach_exception
        # names (they can only occur on macOS).
        if exceptions:
            sdk_info = get_sdk_from_event(data)
            for ex in exceptions:
                if 'mechanism' in ex:
                    normalize_mechanism_meta(ex['mechanism'], sdk_info)

        # This function parses the User Agent from the request if present and fills
        # contexts with it.
        normalize_user_agent(data)

        if not get_path(data, "user", "ip_address"):
            # If there is no User ip_address, update it either from the Http
            # interface or the client_ip of the request.
            http_ip = get_path(data, 'request', 'env', 'REMOTE_ADDR')
            if http_ip:
                set_path(data, 'user', 'ip_address', value=http_ip)
            elif self._client_ip:
                set_path(data, 'user', 'ip_address', value=self._client_ip)

        # Trim values
        if data.get('logger'):
            data['logger'] = trim(data['logger'].strip(), 64)

        if data.get('extra'):
            trim_dict(data['extra'], max_size=settings.SENTRY_MAX_EXTRA_VARIABLE_SIZE)

        if data.get('culprit'):
            data['culprit'] = trim(data['culprit'], MAX_CULPRIT_LENGTH)

        if data.get('transaction'):
            # XXX: This will be trimmed again when inserted into tag values
            data['transaction'] = trim(data['transaction'], MAX_CULPRIT_LENGTH)

        # Move some legacy data into tags
        site = data.pop('site', None)
        if site is not None:
            set_tag(data, 'site', site)
        server_name = data.pop('server_name', None)
        if server_name is not None:
            set_tag(data, 'server_name', server_name)

        for key in ('fingerprint', 'modules', 'tags', 'extra', 'contexts'):
            if not data.get(key):
                data.pop(key, None)

        # Merge meta errors into the errors array. We need to iterate over the
        # raw meta instead of data due to pruned null values.
        errors = data.get('errors') or []
        add_meta_errors(errors, meta)
        add_meta_errors(errors, meta.enter('tags'))

        if errors:
            data['errors'] = errors
        elif 'errors' in data:
            del data['errors']

        if meta.raw():
            data['_meta'] = meta.raw()
        elif '_meta' in data:
            del data['_meta']

        self._data = CanonicalKeyDict(prune_empty_keys(data))

    def should_filter(self):
        '''
        returns (result: bool, reason: string or None)
        Result is True if an event should be filtered
        The reason for filtering is passed along as a string
        so that we can store it in metrics
        '''
        for name in SECURITY_REPORT_INTERFACES:
            if name in self._data:
                interface = get_interface(name)
                if interface.to_python(self._data[name]).should_filter(self._project):
                    return (True, FilterStatKeys.INVALID_CSP)

        if self._client_ip and not is_valid_ip(self._project, self._client_ip):
            return (True, FilterStatKeys.IP_ADDRESS)

        release = self._data.get('release')
        if release and not is_valid_release(self._project, release):
            return (True, FilterStatKeys.RELEASE_VERSION)

        error_message = get_path(self._data, 'logentry', 'formatted') \
            or get_path(self._data, 'logentry', 'message') \
            or ''
        if error_message and not is_valid_error_message(self._project, error_message):
            return (True, FilterStatKeys.ERROR_MESSAGE)

        for exc in get_path(self._data, 'exception', 'values', filter=True, default=[]):
            message = u': '.join(
                filter(None, map(exc.get, ['type', 'value']))
            )
            if message and not is_valid_error_message(self._project, message):
                return (True, FilterStatKeys.ERROR_MESSAGE)

        for filter_cls in filters.all():
            filter_obj = filter_cls(self._project)
            if filter_obj.is_enabled() and filter_obj.test(self._data):
                return (True, six.text_type(filter_obj.id))

        return (False, None)

    def get_data(self):
        return self._data

    def _get_event_instance(self, project_id=None):
        data = self._data
        event_id = data.get('event_id')
        platform = data.get('platform')

        recorded_timestamp = data.get('timestamp')
        date = datetime.fromtimestamp(recorded_timestamp)
        date = date.replace(tzinfo=timezone.utc)
        time_spent = data.get('time_spent')

        data['node_id'] = Event.generate_node_id(project_id, event_id)

        return Event(
            project_id=project_id or self._project.id,
            event_id=event_id,
            data=data,
            time_spent=time_spent,
            datetime=date,
            platform=platform
        )

    def get_culprit(self):
        """Helper to calculate the default culprit"""
        return force_text(
            self._data.get('culprit') or
            self._data.get('transaction') or
            generate_culprit(self._data, platform=self._data['platform']) or
            ''
        )

    def get_event_type(self):
        """Returns the event type."""
        return eventtypes.get(self._data.get('type', 'default'))(self._data)

    def get_search_message(self, event_metadata=None, culprit=None):
        """This generates the internal event.message attribute which is used
        for search purposes.  It adds a bunch of data from the metadata and
        the culprit.
        """
        if event_metadata is None:
            event_metadata = self.get_event_type().get_metadata()
        if culprit is None:
            culprit = self.get_culprit()

        data = self._data
        message = ''

        if data.get('logentry'):
            message += (data['logentry'].get('formatted') or
                        data['logentry'].get('message') or '')

        if event_metadata:
            for value in six.itervalues(event_metadata):
                value_u = force_text(value, errors='replace')
                if value_u not in message:
                    message = u'{} {}'.format(message, value_u)

        if culprit and culprit not in message:
            culprit_u = force_text(culprit, errors='replace')
            message = u'{} {}'.format(message, culprit_u)

        return trim(message.strip(), settings.SENTRY_MAX_MESSAGE_LENGTH)

    def save(self, project_id, raw=False, assume_normalized=False):
        # Normalize if needed
        if not self._normalized:
            if not assume_normalized:
                self.normalize()
            self._normalized = True

        data = self._data

        project = Project.objects.get_from_cache(id=project_id)

        # Check to make sure we're not about to do a bunch of work that's
        # already been done if we've processed an event with this ID. (This
        # isn't a perfect solution -- this doesn't handle ``EventMapping`` and
        # there's a race condition between here and when the event is actually
        # saved, but it's an improvement. See GH-7677.)
        try:
            event = Event.objects.get(
                project_id=project.id,
                event_id=data['event_id'],
            )
        except Event.DoesNotExist:
            pass
        else:
            logger.info(
                'duplicate.found',
                exc_info=True,
                extra={
                    'event_uuid': data['event_id'],
                    'project_id': project.id,
                    'model': Event.__name__,
                }
            )
            return event

        # Pull out the culprit
        culprit = self.get_culprit()

        # Pull the toplevel data we're interested in
        level = data.get('level')

        # TODO(mitsuhiko): this code path should be gone by July 2018.
        # This is going to be fine because no code actually still depends
        # on integers here.  When we need an integer it will be converted
        # into one later.  Old workers used to send integers here.
        if level is not None and isinstance(level, six.integer_types):
            level = LOG_LEVELS[level]

        transaction_name = data.get('transaction')
        logger_name = data.get('logger')
        fingerprint = data.get('fingerprint') or ['{{ default }}']
        release = data.get('release')
        dist = data.get('dist')
        environment = data.get('environment')
        recorded_timestamp = data.get('timestamp')

        # We need to swap out the data with the one internal to the newly
        # created event object
        event = self._get_event_instance(project_id=project_id)
        self._data = data = event.data.data

        event._project_cache = project

        date = event.datetime
        platform = event.platform
        event_id = event.event_id

        if transaction_name:
            transaction_name = force_text(transaction_name)

        # Some of the data that are toplevel attributes are duplicated
        # into tags (logger, level, environment, transaction).  These are
        # different from legacy attributes which are normalized into tags
        # ahead of time (site, server_name).
        setdefault_path(data, 'tags', value=[])
        set_tag(data, 'level', level)
        if logger_name:
            set_tag(data, 'logger', logger_name)
        if environment:
            set_tag(data, 'environment', environment)
        if transaction_name:
            set_tag(data, 'transaction', transaction_name)

        if release:
            # dont allow a conflicting 'release' tag
            pop_tag(data, 'release')
            release = Release.get_or_create(
                project=project,
                version=release,
                date_added=date,
            )
            set_tag(data, 'sentry:release', release.version)

        if dist and release:
            dist = release.add_dist(dist, date)
            # dont allow a conflicting 'dist' tag
            pop_tag(data, 'dist')
            set_tag(data, 'sentry:dist', dist.name)
        else:
            dist = None

        event_user = self._get_event_user(project, data)
        if event_user:
            # dont allow a conflicting 'user' tag
            pop_tag(data, 'user')
            set_tag(data, 'sentry:user', event_user.tag_value)

        # At this point we want to normalize the in_app values in case the
        # clients did not set this appropriately so far.
        normalize_in_app(data)

        for plugin in plugins.for_project(project, version=None):
            added_tags = safe_execute(plugin.get_tags, event, _with_transaction=False)
            if added_tags:
                # plugins should not override user provided tags
                for key, value in added_tags:
                    if get_tag(data, key) is None:
                        set_tag(data, key, value)

        for path, iface in six.iteritems(event.interfaces):
            for k, v in iface.iter_tags():
                set_tag(data, k, v)
            # Get rid of ephemeral interface data
            if iface.ephemeral:
                data.pop(iface.path, None)

        # Put the actual fingerprint back
        data['fingerprint'] = fingerprint

        hashes = event.get_hashes()

        event_type = self.get_event_type()
        event_metadata = event_type.get_metadata()

        data['type'] = event_type.key
        data['metadata'] = event_metadata
        data['hashes'] = hashes

        # index components into ``Event.message``
        # See GH-3248
        event.message = self.get_search_message(event_metadata, culprit)
        received_timestamp = event.data.get('received') or float(event.datetime.strftime('%s'))

        kwargs = {
            'platform': platform,
            'message': event.message,
            'culprit': culprit,
            'logger': logger_name,
            'level': LOG_LEVELS_MAP.get(level),
            'last_seen': date,
            'first_seen': date,
            'active_at': date,
            'data': {
                'last_received': received_timestamp,
                'type': event_type.key,
                # we cache the events metadata on the group to ensure its
                # accessible in the stream
                'metadata': event_metadata,
            },
        }

        if release:
            kwargs['first_release'] = release

        try:
            group, is_new, is_regression, is_sample = self._save_aggregate(
                event=event, hashes=hashes, release=release, **kwargs
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
                event_size=event.size,
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
                logger.info(
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
                logger.info(
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

            tagstore.delay_index_event_tags(
                organization_id=project.organization_id,
                project_id=project.id,
                group_id=group.id,
                environment_id=environment.id,
                event_id=event.id,
                tags=event.tags,
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

        safe_execute(
            Group.objects.add_tags,
            group,
            environment,
            event.get_tags(),
            _with_transaction=False)

        if not raw:
            if not project.first_event:
                project.update(first_event=date)
                first_event_received.send_robust(project=project, group=group, sender=Project)

        eventstream.insert(
            group=group,
            event=event,
            is_new=is_new,
            is_sample=is_sample,
            is_regression=is_regression,
            is_new_group_environment=is_new_group_environment,
            primary_hash=hashes[0],
            # We are choosing to skip consuming the event back
            # in the eventstream if it's flagged as raw.
            # This means that we want to publish the event
            # through the event stream, but we don't care
            # about post processing and handling the commit.
            skip_consume=raw,
        )

        metrics.timing(
            'events.latency',
            received_timestamp - recorded_timestamp,
            tags={
                'project_id': project.id,
            },
        )

        return event

    def _get_event_user(self, project, data):
        user_data = data.get('user')
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

        cache_key = u'euserid:1:{}:{}'.format(
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
            # way to fix this, since we can't update the group on those hashes
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

        elif has_pending_commit_resolution(group):
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

            kick_off_status_syncs.apply_async(kwargs={
                'project_id': group.project_id,
                'group_id': group.id,
            })

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
