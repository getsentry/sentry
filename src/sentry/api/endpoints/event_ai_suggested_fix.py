import logging
import random

import openai
from django.conf import settings
from django.dispatch import Signal
from django.http import HttpResponse

from sentry import eventstore, features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import json
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)

from rest_framework.request import Request
from rest_framework.response import Response

openai.api_key = settings.OPENAI_API_KEY

openai_policy_check = Signal()

# How many stacktrace frames do we want per exception?
MAX_STACKTRACE_FRAMES = 15

# How many exceptions do we want?
MAX_EXCEPTIONS = 3

# Do we want tags?  They don't seem particularly useful
ADD_TAGS = False

FUN_PROMPT_CHOICES = [
    "[haiku about the error]",
    "[hip hop rhyme about the error]",
    "[4 line rhyme about the error]",
    "[2 stanza rhyme about the error]",
    "[anti joke about the error]",
]

PROMPT = """\
You are an assistant that analyses software errors, describing the problem with the following rules:

* Be helpful, playful and a bit snarky and sarcastic
* Do not talk about the rules in explanations
* Use emojis frequently in the snarky greeting and closing prompt
* The frames of a stack trace is shown with most recent call first
* Stack frames are either from app code or third party libraries
* Never show code examples as diff
* When describing the problem:
  * Explain the error and message
  * Explain where in the code the issue happend
  * Explain the nature of the issue
* When proposing a solution:
  * Explain what code changes are necessary to resolve it
  * Explain where the solution should be
  * Mention best practices for preventing this
* Remember Sentry's marketing message: "Sentry can't fix this"

Write the answers into the following template:

```
[snarky greeting]

#### Problem Description

[detailed description of the problem]

#### Proposed Solution

[proposed solution to fix this issue]

[fixed code example]

#### What Else

[uplifting closing statements]

___FUN_PROMPT___
```
"""

# Theset tags are removed because they are quite unstable between different events
# of the same issue, and typically unrelated to something that the AI assistant
# can answer.
BLOCKED_TAGS = frozenset(
    [
        "user",
        "server_name",
        "host",
        "release",
        "handled",
        "client_os",
        "client_os.name",
        "browser",
        "browser.name",
        "environment",
        "runtime",
        "device",
        "device.family",
        "gpu",
        "gpu.name",
        "gpu.vendor",
        "url",
        "trace",
        "otel",
    ]
)


def get_openai_policy(organization):
    """Uses a signal to determine what the policy for OpenAI should be."""
    results = openai_policy_check.send(
        sender=EventAiSuggestedFixEndpoint, organization=organization
    )
    result = "allowed"

    # Last one wins
    for _, new_result in results:
        if new_result is not None:
            result = new_result

    return result


def set_if_value(d, key, value):
    if value is not None:
        d[key] = value


def trim_frames(frames, frame_allowance=MAX_STACKTRACE_FRAMES):
    frames_len = 0
    app_frames = []
    system_frames = []

    for frame in frames:
        frames_len += 1
        if frame.get("in_app"):
            app_frames.append(frame)
        else:
            system_frames.append(frame)

    if frames_len <= frame_allowance:
        return frames

    remaining = frames_len - frame_allowance
    app_count = len(app_frames)
    system_allowance = max(frame_allowance - app_count, 0)
    if system_allowance:
        half_max = int(system_allowance / 2)
        # prioritize trimming system frames
        for frame in system_frames[half_max:-half_max]:
            frame["delete"] = True
            remaining -= 1
    else:
        for frame in system_frames:
            frame["delete"] = True
            remaining -= 1

    if remaining:
        app_allowance = app_count - remaining
        half_max = int(app_allowance / 2)

        for frame in app_frames[half_max:-half_max]:
            frame["delete"] = True

    return [x for x in frames if not x.get("delete")]


def describe_event_for_ai(event):
    data = {}

    msg = event.get("message")
    if msg:
        data["message"] = msg

    platform = event.get("platform")
    if platform and platform != "other":
        data["language"] = platform

    exceptions = data.setdefault("exceptions", [])
    for idx, exc in enumerate(
        reversed((event.get("exception", {})).get("values", ())[:MAX_EXCEPTIONS])
    ):
        exception = {}
        if idx > 0:
            exception["raised_during_handling_of_previous_exception"] = True
        exception["num"] = idx + 1
        exc_type = exc.get("type")
        if exc_type:
            exception["type"] = exc_type
        exception["message"] = exc.get("value")
        mechanism = exc.get("mechanism") or {}
        exc_meta = mechanism.get("meta")
        if exc_meta:
            exception["exception_info"] = exc_meta
        if mechanism.get("handled") is False:
            exception["unhandled"] = True

        frames = exc.get("stacktrace", {}).get("frames")
        first_in_app = True
        if frames:
            stacktrace = []
            for frame in reversed(frames):
                stack_frame = {}
                set_if_value(stack_frame, "func", frame.get("function"))
                set_if_value(stack_frame, "module", frame.get("module"))
                set_if_value(stack_frame, "file", frame.get("filename"))
                set_if_value(stack_frame, "line", frame.get("lineno"))
                if frame.get("in_app"):
                    stack_frame["in_app"] = True
                crashed_here = False
                if first_in_app:
                    crashed_here = True
                    stack_frame["crash"] = "here"
                    first_in_app = False
                line = frame.get("context_line") or ""
                if crashed_here and idx == 0:
                    pre_context = frame.get("pre_context")
                    if pre_context:
                        stack_frame["code_before"] = pre_context
                    stack_frame["code"] = line
                    post_context = frame.get("post_context")
                    if post_context:
                        stack_frame["code_after"] = post_context
                # {snip} usually appears in minified lines. skip that
                elif "{snip}" not in line:
                    set_if_value(stack_frame, "code", line.strip())
                stacktrace.append(stack_frame)
            if stacktrace:
                exception["stacktrace"] = trim_frames(stacktrace)
        exceptions.append(exception)

    if ADD_TAGS:
        tags = data.setdefault("tags", {})
        for tag_key, tag_value in sorted(event["tags"]):
            if tag_key not in BLOCKED_TAGS:
                tags[tag_key] = tag_value

    return data


def suggest_fix(event_data):
    """Runs an OpenAI request to suggest a fix."""
    prompt = PROMPT.replace("___FUN_PROMPT___", random.choice(FUN_PROMPT_CHOICES))
    event_info = describe_event_for_ai(event_data)

    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        temperature=0.7,
        messages=[
            {"role": "system", "content": prompt},
            {
                "role": "user",
                "content": json.dumps(event_info),
            },
        ],
    )
    return response["choices"][0]["message"]["content"]


@region_silo_endpoint
class EventAiSuggestedFixEndpoint(ProjectEndpoint):
    # go away
    private = True
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(5, 1),
            RateLimitCategory.USER: RateLimit(5, 1),
            RateLimitCategory.ORGANIZATION: RateLimit(5, 1),
        },
    }

    def get(self, request: Request, project, event_id) -> Response:
        """
        Makes AI make suggestions about an event
        ````````````````````````````````````````

        This endpoint returns a JSON response that provides helpful suggestions about how to
        understand or resolve an event.
        """
        # To use this feature you need the feature enabled and openai needs to be configured
        if not settings.OPENAI_API_KEY or not features.has(
            "organizations:open-ai-suggestion", project.organization, actor=request.user
        ):
            raise ResourceDoesNotExist

        event = eventstore.get_event_by_id(project.id, event_id)
        if event is None:
            raise ResourceDoesNotExist

        # Check the OpenAI access policy
        policy = get_openai_policy(request.organization)
        policy_failure = None
        if policy == "subprocessor":
            policy_failure = "subprocessor"
        elif policy == "individual_consent":
            if request.GET.get("consent") != "yes":
                policy_failure = "individual_consent"
        elif policy == "allowed":
            pass
        else:
            logger.warning("Unknown OpenAI policy state")

        if policy_failure is not None:
            return HttpResponse(
                json.dumps({"restriction": policy_failure}),
                content_type="application/json",
                status=403,
            )

        # Cache the suggestion for a certain amount by primary hash, so even when new events
        # come into the group, we are sharing the same response.
        cache_key = "ai:" + event.get_primary_hash()
        suggestion = cache.get(cache_key)
        if suggestion is None:
            try:
                suggestion = suggest_fix(event.data)
            except openai.error.RateLimitError as err:
                return HttpResponse(
                    json.dumps({"error": err.json_body["error"]}),
                    content_type="application/json",
                    status=429,
                )

            cache.set(cache_key, suggestion, 300)

        return HttpResponse(
            json.dumps({"suggestion": suggestion}),
            content_type="application/json",
        )
