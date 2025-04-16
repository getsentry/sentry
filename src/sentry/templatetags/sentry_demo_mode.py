from django import template
from django.utils.safestring import mark_safe

from sentry.demo_mode.utils import is_demo_mode_enabled

register = template.Library()


@register.simple_tag
def init_demo_analytics(domain):
    if not is_demo_mode_enabled():
        return ""

    html = f"""
    <script defer data-domain="{domain}" src="https://plausible.io/js/script.pageview-props.tagged-events.js"></script>
    <script>window.plausible = window.plausible || function() {{ (window.plausible.q = window.plausible.q || []).push(arguments) }}</script>
    """
    return mark_safe(html)
