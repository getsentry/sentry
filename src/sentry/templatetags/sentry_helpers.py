import functools
import os.path
import random
from collections import namedtuple
from datetime import datetime, timedelta, timezone
from random import randint
from urllib.parse import quote, urlencode

from django import template
from django.template.defaultfilters import stringfilter
from django.utils import timezone as django_timezone
from django.utils.safestring import mark_safe
from django.utils.translation import gettext as _
from packaging.version import parse as parse_version

from sentry import options
from sentry.api.serializers import serialize as serialize_func
from sentry.utils import json
from sentry.utils.strings import soft_break as _soft_break
from sentry.utils.strings import soft_hyphenate, truncatechars

SentryVersion = namedtuple("SentryVersion", ["current", "latest", "update_available", "build"])

register = template.Library()

truncatechars = register.filter(stringfilter(truncatechars), is_safe=True)


@register.filter
def to_json(obj, request=None):
    return json.dumps_htmlsafe(obj)


@register.filter
def multiply(x, y):
    def coerce(value):
        if isinstance(value, ((int,), float)):
            return value
        try:
            return int(value)
        except ValueError:
            return float(value)

    return coerce(x) * coerce(y)


class AbsoluteUriNode(template.Node):
    def __init__(self, args, target_var):
        self.args = args
        self.target_var = target_var

    def render(self, context):
        from sentry.utils.http import absolute_uri

        # Attempt to resolve all arguments into actual variables.
        # This converts a value such as `"foo"` into the string `foo`
        # and will look up a value such as `foo` from the context as
        # the variable `foo`. If the variable does not exist, silently
        # resolve as an empty string, which matches the behavior
        # `SimpleTagNode`
        args = []
        for arg in self.args:
            try:
                arg = template.Variable(arg).resolve(context)
            except template.VariableDoesNotExist:
                arg = ""
            args.append(arg)

        # No args is just fine
        if not args:
            rv = ""
        # If there's only 1 argument, there's nothing to format
        elif len(args) == 1:
            rv = args[0]
        else:
            rv = args[0].format(*args[1:])

        rv = absolute_uri(rv)

        # We're doing an `as foo` and we want to assign the result
        # to a variable instead of actually returning.
        if self.target_var is not None:
            context[self.target_var] = rv
            rv = ""

        return rv


@register.tag
def absolute_uri(parser, token):
    bits = token.split_contents()[1:]
    # Check if the last two bits are `as {var}`
    if len(bits) >= 2 and bits[-2] == "as":
        target_var = bits[-1]
        bits = bits[:-2]
    else:
        target_var = None
    return AbsoluteUriNode(bits, target_var)


@register.simple_tag
def org_url(organization, path, query=None, fragment=None) -> str:
    """
    Generate an absolute url for an organization
    """
    if not hasattr(organization, "absolute_url"):
        raise RuntimeError("organization parameter is not an Organization instance")
    return organization.absolute_url(path, query=query, fragment=fragment)


LOADING_MESSAGES = [
    "Loading a <scraps-bleep>$#!%</scraps-bleep>-ton of JavaScript&hellip;",
    "Escaping <code>node_modules</code> gravity well&hellip;",
    "Parallelizing webpack builders&hellip;",
    "Awaiting solution to the halting problem&hellip;",
    "Collapsing wavefunctions&hellip;",
    "Reticulating splines&hellip;",
    "Making it make sense&hellip;",
    "Deploying swarm of autonomous agents&hellip;",
    "Installing <code>left-pad</code>&hellip;",
]

PRIDE_LOADING_MESSAGES = [
    "Exceptions belong in code; You belong here.",
    "You&rsquo;re valid. Your code, however&hellip;",
    "Making space for everyone&hellip;",
    "Waving some flags while you wait&hellip;",
]


def _get_organization_from_context(context):
    org_context = context.get("org_context")
    if org_context is not None:
        return getattr(org_context, "organization", None)
    return None


def _is_themed_loader(context) -> bool:
    organization = _get_organization_from_context(context)
    if organization is None:
        return False
    from sentry import features

    return features.has("organizations:sentry-pride-logo-footer", organization)


@register.simple_tag(takes_context=True)
def loading_message(context):
    options = list(LOADING_MESSAGES)
    if _is_themed_loader(context):
        options.extend(PRIDE_LOADING_MESSAGES)
    return mark_safe(random.choice(options))


@register.simple_tag(takes_context=True)
def loader(context):
    from django.template.loader import render_to_string

    template_name = (
        "sentry/partial/loader-pride.html"
        if _is_themed_loader(context)
        else "sentry/partial/loader.html"
    )
    return mark_safe(render_to_string(template_name, context.flatten()))


@register.simple_tag
def querystring(**kwargs):
    return urlencode(kwargs, doseq=False)


@register.simple_tag
def system_origin():
    from sentry.utils.http import absolute_uri, origin_from_url

    return origin_from_url(absolute_uri())


@register.simple_tag
def security_contact():
    return options.get("system.security-email") or options.get("system.admin-email")


@register.filter
def is_url(value):
    if not isinstance(value, str):
        return False
    if not value.startswith(("http://", "https://")):
        return False
    if " " in value:
        return False
    return True


@register.filter
def absolute_value(value):
    return abs(int(value) if isinstance(value, int) else float(value))


@register.filter
def as_sorted(value):
    return sorted(value)


@register.filter
def small_count(v, precision=1):
    if not v:
        return 0
    z = [(1000000000, _("b")), (1000000, _("m")), (1000, _("k"))]
    v = int(v)
    for x, y in z:
        o, p = divmod(v, x)
        if o:
            if len(str(o)) > 2 or not p:
                return "%d%s" % (o, y)
            return (f"%.{precision}f%s") % (v / float(x), y)
    return v


@register.filter
def format_duration_ms(v):
    """Format a duration in milliseconds to a human-readable string."""
    try:
        v = float(v)
    except (TypeError, ValueError):
        return "0ms"
    if v < 1:
        return "0ms"
    if v < 1000:
        return f"{v:.0f}ms"
    seconds = v / 1000
    if seconds < 60:
        return f"{seconds:.1f}s"
    minutes = seconds / 60
    if minutes < 60:
        return f"{minutes:.1f}min"
    hours = minutes / 60
    if hours < 24:
        return f"{hours:.1f}hr"
    days = hours / 24
    if days < 30.44:
        return f"{days:.1f}d"
    months = days / 30.44
    if days < 365.25:
        return f"{months:.1f}mo"
    years = days / 365.25
    return f"{years:.1f}yr"


@register.filter
def as_tag_alias(v):
    return {"sentry:release": "release", "sentry:dist": "dist", "sentry:user": "user"}.get(v, v)


@register.simple_tag(takes_context=True)
def serialize(context, value):
    value = serialize_func(value, context["request"].user)
    return json.dumps_htmlsafe(value)


@register.simple_tag(takes_context=True)
def get_sentry_version(context):
    import sentry

    current = sentry.VERSION

    latest = options.get("sentry:latest_version") or current
    update_available = parse_version(latest) > parse_version(current)
    build = sentry.__build__ or current

    context["sentry_version"] = SentryVersion(current, latest, update_available, build)
    return ""


@register.filter
def timesince(value, now=None):
    from django.utils.timesince import timesince

    if now is None:
        now = django_timezone.now()
    if not value:
        return _("never")
    if value < (now - timedelta(days=5)):
        return value.date()
    value = (" ".join(timesince(value, now).split(" ")[0:2])).strip(",")
    if value == _("0 minutes"):
        return _("just now")
    if value == _("1 day"):
        return _("yesterday")
    return _("%s ago") % value


@register.filter
def duration(value):
    if not value:
        return "0s"
    # value is assumed to be in ms
    value = value / 1000.0
    hours, minutes, seconds = 0, 0, 0
    if value > 3600:
        hours = value / 3600
        value = value % 3600
    if value > 60:
        minutes = value / 60
        value = value % 60
    seconds = value
    output = []
    if hours:
        output.append("%dh" % hours)
    if minutes:
        output.append("%dm" % minutes)
    if seconds > 1:
        output.append("%0.2fs" % seconds)
    elif seconds:
        output.append("%dms" % (seconds * 1000))
    return "".join(output)


@register.filter
def date(dt, arg=None):
    from django.template.defaultfilters import date

    if isinstance(dt, datetime) and not django_timezone.is_aware(dt):
        dt = dt.replace(tzinfo=timezone.utc)
    return date(dt, arg)


@register.filter
def day_initial(dt):
    """Returns the single-letter day-of-week initial (M, T, W, T, F, S, S)."""
    if isinstance(dt, datetime) and not django_timezone.is_aware(dt):
        dt = dt.replace(tzinfo=timezone.utc)
    return "MTWTFSS"[dt.weekday()]


@register.simple_tag
def percent(value, total, format=None):
    if not (value and total):
        result = 0.0
    else:
        result = int(value) / float(total) * 100

    if format is None:
        return int(result)
    else:
        return ("%%%s" % format) % result


@register.filter
def titleize(value):
    return value.replace("_", " ").title()


@register.filter
def split(value, delim=""):
    return value.split(delim)


@register.filter
def urlquote(value, safe=""):
    return quote(value.encode("utf8"), safe)


@register.filter
def basename(value):
    return os.path.basename(value)


@register.filter
def soft_break(value, length):
    return _soft_break(
        value, length, functools.partial(soft_hyphenate, length=max(length // 10, 10))
    )


@register.simple_tag
def random_int(a, b=None):
    if b is None:
        a, b = 0, a
    return randint(a, b)


@register.filter
def get_item(dictionary, key):
    return dictionary.get(key, "")


@register.filter
@stringfilter
def sanitize_periods(value):
    """
    Primarily used in email templates when a field may contain a domain name to prevent
    email clients from creating a clickable link to the domain.
    """
    from sentry.utils.email.sanitize import sanitize_outbound_name

    return sanitize_outbound_name(value)
