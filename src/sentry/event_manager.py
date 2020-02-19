from __future__ import absolute_import, print_function

import logging
import time

import jsonschema
import six

from sentry.constants import DEFAULT_STORE_NORMALIZER_ARGS, MAX_SECS_IN_FUTURE, MAX_SECS_IN_PAST
from sentry.message_filters import should_filter_event
from sentry.grouping.api import get_grouping_config_dict_for_project
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
from sentry.models import EventError
from sentry.save_event import save_event
from sentry.utils import metrics
from sentry.utils.canonical import CanonicalKeyDict
from sentry.utils.data_filters import (
    is_valid_ip,
    is_valid_release,
    is_valid_error_message,
    FilterStatKeys,
)
from sentry.utils.safe import get_path

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

    def save(self, project_id, assume_normalized=False, **kwargs):
        # Normalize if needed
        if not self._normalized:
            if not assume_normalized:
                self.normalize()
            self._normalized = True

        event = save_event(self._data, project_id or self._project.id, **kwargs)
        self._data = event.data.data
        return event
