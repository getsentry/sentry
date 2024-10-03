from drf_spectacular.utils import OpenApiExample


class EventExamples:
    PROJECT_EVENTS_SIMPLE = [
        OpenApiExample(
            "Return a list of error events bound to a project",
            value=[
                {
                    "eventID": "9fac2ceed9344f2bbfdd1fdacb0ed9b1",
                    "tags": [
                        {"key": "browser", "value": "Chrome 60.0"},
                        {"key": "device", "value": "Other"},
                        {"key": "environment", "value": "production"},
                        {"value": "fatal", "key": "level"},
                        {"key": "os", "value": "Mac OS X 10.12.6"},
                        {"value": "CPython 2.7.16", "key": "runtime"},
                        {"key": "release", "value": "17642328ead24b51867165985996d04b29310337"},
                        {"key": "server_name", "value": "web1.example.com"},
                    ],
                    "dateCreated": "2020-09-11T17:46:36Z",
                    "user": None,
                    "message": "",
                    "title": "This is an example Python exception",
                    "id": "dfb1a2d057194e76a4186cc8a5271553",
                    "platform": "python",
                    "event.type": "error",
                    "groupID": "1889724436",
                    "crashFile": None,
                    "location": "example.py:123",
                    "culprit": "/books/new/",
                    "projectID": "49271",
                }
            ],
            response_only=True,
            status_codes=["200"],
        )
    ]
