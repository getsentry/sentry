import pytest
from pydantic import ValidationError

from sentry.issues.formatting.models import (
    Breadcrumb,
    EventObject,
    EvidenceSpan,
    ExceptionDetails,
    Frame,
    RequestDetails,
    Stacktrace,
    ThreadDetails,
    UserDetails,
)


def test_minimal_event_only_requires_title() -> None:
    event = EventObject(title="ValueError: boom")
    assert event.title == "ValueError: boom"
    # collections default to empty, scalars to None
    assert event.exceptions == []
    assert event.threads == []
    assert event.breadcrumbs == []
    assert event.tags == []
    assert event.contexts == {}
    assert event.spans == []
    assert event.request is None
    assert event.user is None


def test_title_is_required() -> None:
    with pytest.raises(ValidationError):
        EventObject()  # type: ignore[call-arg]  # missing required `title` is the point


def test_full_event_nests_submodels() -> None:
    event = EventObject(
        title="ValueError: boom",
        message="boom happened",
        exceptions=[
            ExceptionDetails(
                type="ValueError",
                value="boom",
                is_handled=False,
                stacktrace=Stacktrace(
                    frames=[
                        Frame(
                            function="do_thing",
                            filename="app.py",
                            line_no=42,
                            context=[(42, "raise ValueError('boom')")],
                            in_app=True,
                        )
                    ]
                ),
            )
        ],
        threads=[ThreadDetails(id=0, name="main", crashed=True)],
        breadcrumbs=[Breadcrumb(type="log", category="app", level="info", message="started")],
        request=RequestDetails(method="GET", url="https://example.com", data={"q": "1"}),
        tags=[("environment", "prod"), ("release", None)],
        user=UserDetails(id="1", email="user@example.com"),
        spans=[EvidenceSpan(op="db", description="SELECT 1", exclusive_time_ms=12.5)],
        short_id="PROJ-1",
    )

    stacktrace = event.exceptions[0].stacktrace
    assert stacktrace is not None
    assert stacktrace.frames[0].line_no == 42
    assert event.exceptions[0].is_handled is False
    assert event.threads[0].crashed is True
    assert event.request is not None
    assert event.request.method == "GET"
    assert event.tags[0] == ("environment", "prod")
    assert event.user is not None
    assert event.user.email == "user@example.com"
    assert event.spans[0].exclusive_time_ms == 12.5
    assert event.short_id == "PROJ-1"


def test_defaults_are_not_shared_between_instances() -> None:
    a = EventObject(title="a")
    b = EventObject(title="b")
    a.exceptions.append(ExceptionDetails(type="X"))
    assert b.exceptions == []
