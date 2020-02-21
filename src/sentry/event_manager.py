from __future__ import absolute_import, print_function

import logging
import time

import jsonschema
import six


from sentry import buffer
from sentry.constants import (
    DEFAULT_STORE_NORMALIZER_ARGS,
    LOG_LEVELS_MAP,
    MAX_SECS_IN_FUTURE,
    MAX_SECS_IN_PAST,
)
from sentry.message_filters import should_filter_event
from sentry.grouping.api import (
    get_grouping_config_dict_for_project,
    get_grouping_config_dict_for_event_data,
    load_grouping_config,
    apply_server_fingerprinting,
    get_fingerprinting_config_for_project,
    GroupingConfigNotFound,
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
from sentry.interfaces.base import get_interface
from sentry.models import (
    EventError,
    GroupEnvironment,
    GroupRelease,
    Project,
    ReleaseProject,
    ReleaseProjectEnvironment,
    UserReport,
    Organization,
)
from sentry.save_event import (
    HashDiscarded,
    _derive_interface_tags_many,
    _derive_plugin_tags_many,
    _eventstream_insert_many,
    _get_event_user_many,
    _get_or_create_environment_many,
    _get_or_create_release_associated_models,
    _get_or_create_release_many,
    _materialize_metadata_many,
    _nodestore_save_many,
    _pull_out_data,
    _save_aggregate,
    _send_event_saved_signal_many,
    _tsdb_record_all_metrics,
    get_attachments,
    pop_tag,
    save_attachments,
    save_event,
    set_tag,
)
from sentry.signals import event_discarded, first_event_received
from sentry.utils import json, metrics
from sentry.utils.canonical import CanonicalKeyDict
from sentry.utils.data_filters import (
    is_valid_ip,
    is_valid_release,
    is_valid_error_message,
    FilterStatKeys,
)
from sentry.utils.safe import get_path
from sentry.stacktraces.processing import normalize_stacktraces_for_grouping

logger = logging.getLogger("sentry.events")

SECURITY_REPORT_INTERFACES = ("csp", "hpkp", "expectct", "expectstaple")


def validate_and_set_timestamp(data, timestamp):
    """
    Helper function for event processors/enhancers to avoid setting broken timestamps.

    If we set a too old or too new timestamp then this affects event retention
    and search.
    """
    # XXX(markus): We should figure out if we could run normalization
    # after event processing again. Right now we duplicate code between here
    # and event normalization
    if timestamp:
        current = time.time()

        if current - MAX_SECS_IN_PAST > timestamp:
            data.setdefault("errors", []).append(
                {"type": EventError.PAST_TIMESTAMP, "name": "timestamp", "value": timestamp}
            )
        elif timestamp > current + MAX_SECS_IN_FUTURE:
            data.setdefault("errors", []).append(
                {"type": EventError.FUTURE_TIMESTAMP, "name": "timestamp", "value": timestamp}
            )
        else:
            data["timestamp"] = float(timestamp)


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


def add_meta_errors(errors, meta):
    for field_meta in meta:
        original_value = field_meta.get().get("val")

        for i, (err_type, err_data) in enumerate(field_meta.iter_errors()):
            error = dict(err_data)
            error["type"] = err_type
            if field_meta.path:
                error["name"] = field_meta.path
            if i == 0 and original_value is not None:
                error["value"] = original_value
            errors.append(error)


def _decode_event(data, content_encoding):
    if isinstance(data, six.binary_type):
        if content_encoding == "gzip":
            data = decompress_gzip(data)
        elif content_encoding == "deflate":
            data = decompress_deflate(data)
        elif data[0] != b"{":
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
        version="5",
        project=None,
        grouping_config=None,
        client_ip=None,
        user_agent=None,
        auth=None,
        key=None,
        content_encoding=None,
        is_renormalize=False,
        remove_other=None,
        project_config=None,
        sent_at=None,
    ):
        self._data = _decode_event(data, content_encoding=content_encoding)
        self.version = version
        self._project = project
        # if not explicitly specified try to get the grouping from project_config
        if grouping_config is None and project_config is not None:
            config = project_config.config
            grouping_config = config.get("grouping_config")
        # if we still don't have a grouping also try the project
        if grouping_config is None and project is not None:
            grouping_config = get_grouping_config_dict_for_project(self._project)
        self._grouping_config = grouping_config
        self._client_ip = client_ip
        self._user_agent = user_agent
        self._auth = auth
        self._key = key
        self._is_renormalize = is_renormalize
        self._remove_other = remove_other
        self._normalized = False
        self.project_config = project_config
        self.sent_at = sent_at

    def process_csp_report(self):
        """Only called from the CSP report endpoint."""
        data = self._data

        try:
            interface = get_interface(data.pop("interface"))
            report = data.pop("report")
        except KeyError:
            raise APIForbidden("No report or interface data")

        # To support testing, we can either accept a built interface instance, or the raw data in
        # which case we build the instance ourselves
        try:
            instance = report if isinstance(report, interface) else interface.from_raw(report)
        except jsonschema.ValidationError as e:
            raise APIError("Invalid security report: %s" % str(e).splitlines()[0])

        def clean(d):
            return dict(filter(lambda x: x[1], d.items()))

        data.update(
            {
                "logger": "csp",
                "message": instance.get_message(),
                "culprit": instance.get_culprit(),
                instance.path: instance.to_json(),
                "tags": instance.get_tags(),
                "errors": [],
                "user": {"ip_address": self._client_ip},
                # Construct a faux Http interface based on the little information we have
                # This is a bit weird, since we don't have nearly enough
                # information to create an Http interface, but
                # this automatically will pick up tags for the User-Agent
                # which is actually important here for CSP
                "request": {
                    "url": instance.get_origin(),
                    "headers": clean(
                        {"User-Agent": self._user_agent, "Referer": instance.get_referrer()}
                    ),
                },
            }
        )

        self._data = data

    def normalize(self):
        with metrics.timer("events.store.normalize.duration"):
            self._normalize_impl()

    def _normalize_impl(self):
        if self._normalized:
            raise RuntimeError("Already normalized")
        self._normalized = True

        from sentry_relay.processing import StoreNormalizer

        rust_normalizer = StoreNormalizer(
            project_id=self._project.id if self._project else None,
            client_ip=self._client_ip,
            client=self._auth.client if self._auth else None,
            key_id=six.text_type(self._key.id) if self._key else None,
            grouping_config=self._grouping_config,
            protocol_version=six.text_type(self.version) if self.version is not None else None,
            is_renormalize=self._is_renormalize,
            remove_other=self._remove_other,
            normalize_user_agent=True,
            sent_at=self.sent_at.isoformat() if self.sent_at is not None else None,
            **DEFAULT_STORE_NORMALIZER_ARGS
        )

        self._data = CanonicalKeyDict(rust_normalizer.normalize_event(dict(self._data)))

    def should_filter(self):
        """
        returns (result: bool, reason: string or None)
        Result is True if an event should be filtered
        The reason for filtering is passed along as a string
        so that we can store it in metrics
        """
        for name in SECURITY_REPORT_INTERFACES:
            if name in self._data:
                interface = get_interface(name)
                if interface.to_python(self._data[name]).should_filter(self._project):
                    return (True, FilterStatKeys.INVALID_CSP)

        if self._client_ip and not is_valid_ip(self.project_config, self._client_ip):
            return (True, FilterStatKeys.IP_ADDRESS)

        release = self._data.get("release")
        if release and not is_valid_release(self.project_config, release):
            return (True, FilterStatKeys.RELEASE_VERSION)

        error_message = (
            get_path(self._data, "logentry", "formatted")
            or get_path(self._data, "logentry", "message")
            or ""
        )
        if error_message and not is_valid_error_message(self.project_config, error_message):
            return (True, FilterStatKeys.ERROR_MESSAGE)

        for exc in get_path(self._data, "exception", "values", filter=True, default=[]):
            message = u": ".join(filter(None, map(exc.get, ["type", "value"])))
            if message and not is_valid_error_message(self.project_config, message):
                return (True, FilterStatKeys.ERROR_MESSAGE)

        return should_filter_event(self.project_config, self._data)

    def get_data(self):
        return self._data

    def save(self, project_id, raw=False, cache_key=None, assume_normalized=False, **kwargs):
        """
        After normalizing and processing an event, save adjacent models such as
        releases and environments to postgres and write the event into
        eventstream. From there it will be picked up by Snuba and
        post-processing.

        We re-insert events with duplicate IDs into Snuba, which is responsible
        for deduplicating events. Since deduplication in Snuba is on the primary
        key (based on event ID, project ID and day), events with same IDs are only
        deduplicated if their timestamps fall on the same day. The latest event
        always wins and overwrites the value of events received earlier in that day.

        Since we increment counters and frequencies here before events get inserted
        to eventstream these numbers may be larger than the total number of
        events if we receive duplicate event IDs that fall on the same day
        (that do not hit cache first).
        """

        # Normalize if needed
        if not self._normalized:
            if not assume_normalized:
                self.normalize()
            self._normalized = True

        with metrics.timer("event_manager.save.project.get_from_cache"):
            project = Project.objects.get_from_cache(id=project_id)

        with metrics.timer("event_manager.save.organization.get_from_cache"):
            project._organization_cache = Organization.objects.get_from_cache(
                id=project.organization_id
            )

        job = {"data": self._data, "project_id": project_id, "raw": raw}
        jobs = [job]
        projects = {project.id: project}

        _pull_out_data(jobs, projects)

        # Right now the event type is the signal to skip the group. This
        # is going to change a lot.
        if job["event"].get_event_type() == "transaction":
            issueless_event = True
        else:
            issueless_event = False

        _get_or_create_release_many(jobs, projects)

        # XXX: remove
        if job["dist"] and job["release"]:
            job["dist"] = job["release"].add_dist(job["dist"], job["event"].datetime)
            # dont allow a conflicting 'dist' tag
            pop_tag(job["data"], "dist")
            set_tag(job["data"], "sentry:dist", job["dist"].name)
        else:
            job["dist"] = None

        _get_event_user_many(jobs, projects)

        with metrics.timer("event_manager.load_grouping_config"):
            # At this point we want to normalize the in_app values in case the
            # clients did not set this appropriately so far.
            grouping_config = load_grouping_config(
                get_grouping_config_dict_for_event_data(job["data"], project)
            )

        with metrics.timer("event_manager.normalize_stacktraces_for_grouping"):
            normalize_stacktraces_for_grouping(job["data"], grouping_config)

        _derive_plugin_tags_many(jobs, projects)
        _derive_interface_tags_many(jobs)

        with metrics.timer("event_manager.apply_server_fingerprinting"):
            # The active grouping config was put into the event in the
            # normalize step before.  We now also make sure that the
            # fingerprint was set to `'{{ default }}' just in case someone
            # removed it from the payload.  The call to get_hashes will then
            # look at `grouping_config` to pick the right parameters.
            job["data"]["fingerprint"] = job["data"].get("fingerprint") or ["{{ default }}"]
            apply_server_fingerprinting(job["data"], get_fingerprinting_config_for_project(project))

        with metrics.timer("event_manager.event.get_hashes"):
            # Here we try to use the grouping config that was requested in the
            # event.  If that config has since been deleted (because it was an
            # experimental grouping config) we fall back to the default.
            try:
                hashes = job["event"].get_hashes()
            except GroupingConfigNotFound:
                job["data"]["grouping_config"] = get_grouping_config_dict_for_project(project)
                hashes = job["event"].get_hashes()

        job["data"]["hashes"] = hashes

        _materialize_metadata_many(jobs)

        job["received_timestamp"] = received_timestamp = job["event"].data.get("received") or float(
            job["event"].datetime.strftime("%s")
        )

        if not issueless_event:
            # The group gets the same metadata as the event when it's flushed but
            # additionally the `last_received` key is set.  This key is used by
            # _save_aggregate.
            group_metadata = dict(job["materialized_metadata"])
            group_metadata["last_received"] = received_timestamp
            kwargs = {
                "platform": job["platform"],
                "message": job["event"].search_message,
                "culprit": job["culprit"],
                "logger": job["logger_name"],
                "level": LOG_LEVELS_MAP.get(job["level"]),
                "last_seen": job["event"].datetime,
                "first_seen": job["event"].datetime,
                "active_at": job["event"].datetime,
                "data": group_metadata,
            }

            if job["release"]:
                kwargs["first_release"] = job["release"]

            try:
                job["group"], job["is_new"], job["is_regression"] = _save_aggregate(
                    event=job["event"], hashes=hashes, release=job["release"], **kwargs
                )
            except HashDiscarded:
                event_discarded.send_robust(project=project, sender=save_event)

                metrics.incr(
                    "events.discarded",
                    skip_internal=True,
                    tags={"organization_id": project.organization_id, "platform": job["platform"]},
                )
                raise
            job["event"].group = job["group"]
        else:
            job["group"] = None
            job["is_new"] = False
            job["is_regression"] = False

        _send_event_saved_signal_many(jobs, projects)

        # store a reference to the group id to guarantee validation of isolation
        # XXX(markus): No clue what this does
        job["event"].data.bind_ref(job["event"])

        _get_or_create_environment_many(jobs, projects)

        if job["group"]:
            group_environment, job["is_new_group_environment"] = GroupEnvironment.get_or_create(
                group_id=job["group"].id,
                environment_id=job["environment"].id,
                defaults={"first_release": job["release"] or None},
            )
        else:
            job["is_new_group_environment"] = False

        _get_or_create_release_associated_models(jobs, projects)

        if job["release"] and job["group"]:
            job["grouprelease"] = GroupRelease.get_or_create(
                group=job["group"],
                release=job["release"],
                environment=job["environment"],
                datetime=job["event"].datetime,
            )

        _tsdb_record_all_metrics(jobs)

        if job["group"]:
            UserReport.objects.filter(project=project, event_id=job["event"].event_id).update(
                group=job["group"], environment=job["environment"]
            )

        # Enusre the _metrics key exists. This is usually created during
        # and prefilled with ingestion sizes.
        event_metrics = job["event"].data.get("_metrics") or {}
        job["event"].data["_metrics"] = event_metrics

        # Capture the actual size that goes into node store.
        event_metrics["bytes.stored.event"] = len(json.dumps(dict(job["event"].data.items())))

        if not issueless_event:
            # Load attachments first, but persist them at the very last after
            # posting to eventstream to make sure all counters and eventstream are
            # incremented for sure.
            attachments = get_attachments(cache_key, job["event"])
            for attachment in attachments:
                key = "bytes.stored.%s" % (attachment.type,)
                event_metrics[key] = (event_metrics.get(key) or 0) + len(attachment.data)

        _nodestore_save_many(jobs)

        if job["release"] and not issueless_event:
            if job["is_new"]:
                buffer.incr(
                    ReleaseProject,
                    {"new_groups": 1},
                    {"release_id": job["release"].id, "project_id": project.id},
                )
            if job["is_new_group_environment"]:
                buffer.incr(
                    ReleaseProjectEnvironment,
                    {"new_issues_count": 1},
                    {
                        "project_id": project.id,
                        "release_id": job["release"].id,
                        "environment_id": job["environment"].id,
                    },
                )

        if not raw:
            if not project.first_event:
                project.update(first_event=job["event"].datetime)
                first_event_received.send_robust(
                    project=project, event=job["event"], sender=Project
                )

        _eventstream_insert_many(jobs)

        if not issueless_event:
            # Do this last to ensure signals get emitted even if connection to the
            # file store breaks temporarily.
            save_attachments(attachments, job["event"])

        metric_tags = {"from_relay": "_relay_processed" in job["data"]}

        metrics.timing(
            "events.latency", received_timestamp - job["recorded_timestamp"], tags=metric_tags
        )
        metrics.timing("events.size.data.post_save", job["event"].size, tags=metric_tags)
        metrics.incr(
            "events.post_save.normalize.errors",
            amount=len(job["data"].get("errors") or ()),
            tags=metric_tags,
        )

        self._data = job["event"].data.data
        return job["event"]
