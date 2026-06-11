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


PROFILE_DETAILS_RESPONSE = {
    "event_id": "9b29bbe17e9d4ee3a6d0fe9b2e8a3b1c",
    "project_id": 1,
    "version": "2",
    "platform": "python",
    "environment": "production",
    "received": "2026-04-15T18:22:31.000Z",
    "timestamp": "2026-04-15T18:22:31.000Z",
    "release": {
        "id": 123456,
        "version": "1.0.0",
        "status": "open",
        "shortVersion": "1.0.0",
        "versionInfo": {
            "package": None,
            "version": {"raw": "1.0.0"},
            "description": "1.0.0",
            "buildHash": None,
        },
        "ref": None,
        "url": None,
        "dateReleased": "2026-04-15T18:00:00Z",
        "dateCreated": "2026-04-15T18:00:00Z",
        "data": {},
        "newGroups": 0,
        "owner": None,
        "commitCount": 0,
        "lastCommit": None,
        "deployCount": 0,
        "lastDeploy": None,
        "authors": [],
        "projects": [{"id": 1, "slug": "my-project", "name": "my-project", "platform": "python"}],
        "firstEvent": "2026-04-15T18:05:00Z",
        "lastEvent": "2026-04-15T18:30:00Z",
        "currentProjectMeta": {},
    },
    "os": {"name": "Linux", "version": "5.15.0", "build_number": ""},
    "device": {"architecture": "x86_64"},
    "runtime": {"name": "CPython", "version": "3.13.0"},
    "profile": {
        "samples": [
            {"stack_id": 0, "thread_id": 1, "elapsed_since_start_ns": 1_000_000},
        ],
        "stacks": [[0, 1]],
        "frames": [
            {"function": "main", "module": "app.main", "in_app": True, "lineno": 10},
            {"function": "do_work", "module": "app.worker", "in_app": True, "lineno": 42},
        ],
        "thread_metadata": {"1": {"name": "MainThread"}},
    },
    "transaction": {
        "name": "GET /api/0/projects/{org}/{proj}/files/dsyms/",
        "trace_id": "0123456789abcdef0123456789abcdef",
        "id": "9b29bbe17e9d4ee3a6d0fe9b2e8a3b1c",
        "active_thread_id": 1,
    },
}


PROFILE_CHUNKS_RESPONSE = {
    "chunk": {
        "chunk_id": "0123456789abcdef0123456789abcdef",
        "profiler_id": "fedcba9876543210fedcba9876543210",
        "project_id": 1,
        "organization_id": 1,
        "environment": "production",
        "platform": "python",
        "release": "1.0.0",
        "received": 1_779_957_840.0,
        "retention_days": 30,
        "version": "2",
        "profile": {
            "samples": [
                {
                    "stack_id": 0,
                    "thread_id": "1",
                    "timestamp": 1_779_957_840.0,
                },
            ],
            "stacks": [[0, 1]],
            "frames": [
                {"function": "main", "module": "app.main", "in_app": True, "lineno": 10},
                {"function": "do_work", "module": "app.worker", "in_app": True, "lineno": 42},
            ],
            "thread_metadata": {"1": {"name": "MainThread"}},
        },
    },
    "debug_chunk_ids": ["0123456789abcdef0123456789abcdef"],
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
    PROFILE_DETAILS = [
        OpenApiExample(
            "Return a single profile by ID",
            value=PROFILE_DETAILS_RESPONSE,
            response_only=True,
            status_codes=["200"],
        )
    ]
    PROFILE_CHUNKS = [
        OpenApiExample(
            "Return continuous-profile chunks for a profiler",
            value=PROFILE_CHUNKS_RESPONSE,
            response_only=True,
            status_codes=["200"],
        )
    ]
