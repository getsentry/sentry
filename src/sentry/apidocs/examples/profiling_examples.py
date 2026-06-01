from typing import Any

from drf_spectacular.utils import OpenApiExample

FLAMEGRAPH_RESPONSE: dict[str, Any] = {
    "activeProfileIndex": 0,
    "metadata": {
        "deviceClassification": "",
        "deviceLocale": "",
        "deviceManufacturer": "",
        "deviceModel": "",
        "deviceOSName": "",
        "deviceOSVersion": "",
        "durationNS": 0,
        "organizationID": 0,
        "platform": "python",
        "profileID": "",
        "projectID": 0,
        "received": "2026-04-15T18:22:31Z",
        "sampled": False,
        "timestamp": "2026-04-15T18:22:31Z",
        "traceID": "",
        "transactionID": "",
        "transactionName": "GET /api/0/projects/{org}/{proj}/files/dsyms/",
        "version": "",
    },
    "platform": "python",
    "transactionName": "GET /api/0/projects/{org}/{proj}/files/dsyms/",
    "projectID": 1,
    "shared": {
        "frames": [
            {
                "name": "handle_request",
                "file": "app/web.py",
                "is_application": True,
                "line": 88,
                "fingerprint": 1111111111,
            },
            {
                "name": "do_work",
                "file": "app/worker.py",
                "is_application": True,
                "line": 42,
                "fingerprint": 2222222222,
            },
            {
                "name": "loads",
                "file": "json/__init__.py",
                "is_application": False,
                "line": 299,
                "fingerprint": 3333333333,
            },
        ],
        "frame_infos": [
            {
                "count": 40,
                "weight": 40,
                "sumDuration": 4000000000,
                "sumSelfTime": 0,
                "p75Duration": 110000000,
                "p95Duration": 180000000,
                "p99Duration": 240000000,
            },
            {
                "count": 40,
                "weight": 40,
                "sumDuration": 4000000000,
                "sumSelfTime": 1000000000,
                "p75Duration": 95000000,
                "p95Duration": 150000000,
                "p99Duration": 210000000,
            },
            {
                "count": 30,
                "weight": 30,
                "sumDuration": 3000000000,
                "sumSelfTime": 3000000000,
                "p75Duration": 81000000,
                "p95Duration": 120000000,
                "p99Duration": 160000000,
            },
        ],
        "profiles": [
            {
                "project_id": 1,
                "profile_id": "a1b2c3d4e5f60718293a4b5c6d7e8f90",
                "start": 1780084617.323,
                "end": 1780084617.8065438,
            }
        ],
    },
    # samples[i] is a call stack of frame indices into shared.frames, sampled weights[i] times
    "profiles": [
        {
            "endValue": 40,
            "isMainThread": True,
            "name": "MainThread",
            "samples": [[0, 1, 2], [0, 1]],
            "sample_counts": [30, 10],
            "samples_examples": [[0], [0]],
            "sample_durations_ns": [3000000000, 1000000000],
            "startValue": 0,
            "threadID": 1,
            "type": "sampled",
            "unit": "count",
            "weights": [30, 10],
        }
    ],
    "metrics": None,
}


class ProfilingExamples:
    FLAMEGRAPH = [
        OpenApiExample(
            "Return a flamegraph for the organization",
            value=FLAMEGRAPH_RESPONSE,
            response_only=True,
            status_codes=["200"],
        )
    ]
