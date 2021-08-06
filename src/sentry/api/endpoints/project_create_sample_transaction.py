import os
from datetime import datetime, timedelta
from uuid import uuid4

import pytz
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectEventPermission
from sentry.api.serializers import serialize
from sentry.constants import DATA_ROOT
from sentry.utils import json
from sentry.utils.dates import to_timestamp
from sentry.utils.samples import create_sample_event_basic

base_platforms_with_transactions = ["javascript", "python", "apple-ios"]


def get_json_name(project):
    for base_platform in base_platforms_with_transactions:
        if project.platform and project.platform.startswith(base_platform):
            # special case for javascript
            if base_platform == "javascript":
                return "react-transaction.json"
            return f"{base_platform}-transaction.json"
    # default
    return "react-transaction.json"


def fix_event_data(data):
    """
    This function will fix timestamps for sample events and generate
    random ids for traces, spans, and the event id.
    Largely based on sentry.utils.samples.load_data but more simple
    """
    timestamp = datetime.utcnow() - timedelta(minutes=1)
    timestamp = timestamp - timedelta(microseconds=timestamp.microsecond % 1000)
    timestamp = timestamp.replace(tzinfo=pytz.utc)
    data["timestamp"] = to_timestamp(timestamp)

    start_timestamp = timestamp - timedelta(seconds=3)
    data["start_timestamp"] = to_timestamp(start_timestamp)

    trace = uuid4().hex
    span_id = uuid4().hex[:16]
    data["event_id"] = uuid4().hex

    data["contexts"]["trace"]["trace_id"] = trace
    data["contexts"]["trace"]["span_id"] = span_id

    for span in data.get("spans", []):
        # Use data to generate span timestamps consistently and based
        # on event timestamp
        duration = span.get("data", {}).get("duration", 10.0)
        offset = span.get("data", {}).get("offset", 0)
        span_start = data["start_timestamp"] + offset
        span["start_timestamp"] = span_start
        span["timestamp"] = span_start + duration

        span["parent_span_id"] = span_id
        span["span_id"] = uuid4().hex[:16]
        span["trace_id"] = trace
    return data


class ProjectCreateSampleTransactionEndpoint(ProjectEndpoint):
    # Members should be able to create sample events.
    # This is the same scope that allows members to view all issues for a project.
    permission_classes = (ProjectEventPermission,)

    def post(self, request, project):
        samples_root = os.path.join(DATA_ROOT, "samples")
        with open(os.path.join(samples_root, get_json_name(project))) as fp:
            data = json.load(fp)

        data = fix_event_data(data)
        event = create_sample_event_basic(
            data, project.id, raw=True, skip_send_first_transaction=True
        )

        data = serialize(event, request.user)
        return Response(data)
