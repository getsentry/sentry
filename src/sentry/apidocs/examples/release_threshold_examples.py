from drf_spectacular.utils import OpenApiExample

from .project_examples import BASE_PROJECT


class ReleaseThresholdExamples:
    THRESHOLD_STATUS_RESPONSE = [
        OpenApiExample(
            "Client key with rate limiting",
            value={
                f"{BASE_PROJECT['slug']}-v1.0.0": [
                    {
                        "project_id": 0,
                        "project_slug": BASE_PROJECT["slug"],
                        "environment": {
                            "name": "production",
                        },
                        "project": BASE_PROJECT,
                        "threshold_type": 0,
                        "trigger_type": "over",
                        "value": 100,
                        "window_in_seconds": 600,
                        "key": "foobar-v1.0.0",
                        "release": f"{BASE_PROJECT['slug']}-v1.0.0",
                        "is_healthy": True,
                        "start": "2022-02-14T19:00:00Z",
                        "end": "2022-02-28T18:03:00Z",
                        "metric_value": 0.1,
                    },
                ],
            },
            status_codes=["200"],
            response_only=True,
        ),
    ]
