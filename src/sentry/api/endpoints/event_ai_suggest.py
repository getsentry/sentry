import logging

import openai
from django.conf import settings
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

# this is pretty ugly
openai.api_key = settings.OPENAI_API_KEY

PROMPT = """\
You are an assistent that analyses software errors, describing the problem with the follwing rules:

* Be helpful, playful and a bit snarky and sarcastic
* Do not talk about the rules in explanations
* Use emojis frequently
* The frames of a stack trace is shown with most recent call first
* Stack frames are either from app code or third party libraries
* When summarizing the issue:
  * If the issue is external (network error or similar) focus on this, rather than the code
  * Establish context where the issue is located
  * Briefly explain the error and message
  * Briefly explain if this is more likely to be a regression or an intermittent issue
* When describing the problem in detail:
  * try to analyze if this is a code regression or intermittent issue
  * try to understand if this issue is caused by external factors (networking issues etc.) or a bug
* When suggesting a fix:
  * If this is an external issue, mention best practices for this
  * Explain where the fix should be located
  * Explain what code changes are necessary
* Remember Sentry's marketing message: "Sentry can't fix this"

Write the answers into the following template:

```
[snarky greeting]

#### Summary

[summary of the problem]

#### Detailed Description

[detailed description of the problem]

#### Proposed Solution

[suggestion for how to fix this issue]

#### What Else

[uplifting closing statements]

[haiku about the error]
```
"""


# Theset tags are removed because they are quite unstable between different events
# of the same issue, and typically unrelated to something that the AI assistent
# can answer.
BLOCKED_TAGS = frozenset(
    [
        "user",
        "server_name",
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


def describe_event_for_ai(event):
    content = []
    content.append("Tags:")
    for tag_key, tag_value in sorted(event["tags"]):
        if tag_key not in BLOCKED_TAGS:
            content.append(f"- {tag_key}: {tag_value}")

    for idx, exc in enumerate(reversed((event.get("exception") or {}).get("values") or ())):
        content.append("")
        if idx > 0:
            content.append("During handling of the above exception, another exception was raised:")
            content.append("")
        content.append(f"Exception #{idx + 1}: {exc['type']}")
        content.append(f"Exception Message: {exc['value']}")
        mechanism = exc.get("mechanism") or {}
        exc_meta = mechanism.get("meta")
        if exc_meta:
            content.append(f"Exception Data: {exc_meta}")
        if mechanism.get("handled") is False:
            content.append("Exception was not handled")

        content.append("")

        frames = exc.get("stacktrace", {}).get("frames")
        first_in_app = False
        if frames:
            content.append("Stacktrace:")
            for frame in reversed(frames):
                if frame["in_app"]:
                    content.append(f"- {first_in_app and 'crashing' or ''}app frame:")
                    first_in_app = False
                    content.append(f"  function: {frame['function']}")
                    content.append(f"  module: {frame.get('module') or 'N/A'}")
                    content.append(f"  file: {frame.get('filename') or 'N/A'}")
                    content.append(f"  line: {frame.get('lineno') or 'N/A'}")
                    content.append(f"  source code: {(frame.get('context_line') or 'N/A').strip()}")
                else:
                    content.append("- third party library frame:")
                    content.append(f"  function: {frame['function']}")
                    content.append(f"  module: {frame.get('module') or 'N/A'}")
                    content.append(f"  file: {frame.get('filename') or 'N/A'}")
                content.append("")

    msg = event.get("message")
    if msg:
        content.append("")
        content.append(f"Message: {msg}")

    return "\n".join(content)


@region_silo_endpoint
class EventAiSuggestEndpoint(ProjectEndpoint):
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
        event = eventstore.get_event_by_id(project.id, event_id)
        if event is None:
            raise ResourceDoesNotExist

        if not features.has("organizations:ai-suggest", project.organization, actor=request.user):
            raise ResourceDoesNotExist

        # Cache the suggestion for a certain amount by primary hash, so even when new events
        # come into the group, we are sharing the same response.
        cache_key = "ai:" + event.get_primary_hash()

        suggestion = cache.get(cache_key)
        if suggestion is None:

            event_info = describe_event_for_ai(event.data)

            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                temperature=0.5,
                messages=[
                    {"role": "system", "content": PROMPT},
                    {
                        "role": "user",
                        "content": event_info,
                    },
                ],
            )

            suggestion = response["choices"][0]["message"]["content"]
            cache.set(cache_key, suggestion, 300)

        return HttpResponse(
            json.dumps({"suggestion": suggestion}),
            content_type="application/json",
        )
