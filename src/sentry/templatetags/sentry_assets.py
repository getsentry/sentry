import six
import re
from django.conf import settings
from django import template
from django.template.base import token_kwargs
from django.utils.safestring import mark_safe

from sentry import options
from sentry.utils.assets import get_asset_url
from sentry.utils.http import absolute_uri

register = template.Library()

register.simple_tag(get_asset_url, name="asset_url")


@register.simple_tag
def absolute_asset_url(module, path):
    """
    Returns a versioned absolute asset URL (located within Sentry's static files).

    Example:
      {% absolute_asset_url 'sentry' 'dist/sentry.css' %}
      =>  "http://sentry.example.com/_static/74d127b78dc7daf2c51f/sentry/dist/sentry.css"
    """
    return absolute_uri(get_asset_url(module, path))


@register.simple_tag
def crossorigin():
    """
    Returns an additional crossorigin="anonymous" snippet for use in a <script> tag if
    our asset urls are from a different domain than the system.url-prefix.
    """
    if absolute_uri(settings.STATIC_URL).startswith(options.get("system.url-prefix")):
        # They share the same domain prefix, so we don't need CORS
        return ""
    return ' crossorigin="anonymous"'


@register.simple_tag(takes_context=True)
def locale_js_include(context):
    """
    If the user has a non-English locale set, returns a <script> tag pointing
    to the relevant locale JavaScript file
    """
    request = context["request"]

    try:
        lang_code = request.LANGUAGE_CODE
    except AttributeError:
        # it's possible that request at this point, LANGUAGE_CODE hasn't be bound
        # to the Request object yet. This specifically happens when rendering our own
        # 500 error page, resulting in yet another error trying to render our error.
        return ""

    if lang_code == "en" or lang_code not in settings.SUPPORTED_LANGUAGES:
        return ""

    nonce = ""
    if hasattr(request, "csp_nonce"):
        nonce = ' nonce="{}"'.format(request.csp_nonce)

    href = get_asset_url("sentry", "dist/locale/" + lang_code + ".js")
    return mark_safe('<script src="{}"{}{}></script>'.format(href, crossorigin(), nonce))


@register.tag
def script(parser, token):
    """
    A custom script tag wrapper that applies
    CSP nonce attribute if found in the request.

    In Saas sentry middleware sets the csp_nonce
    attribute on the request and we strict CSP rules
    to prevent XSS
    """
    try:
        args = token.split_contents()
        kwargs = token_kwargs(args[1:], parser)

        nodelist = parser.parse(("endscript",))
        parser.delete_first_token()

        return ScriptNode(nodelist, **kwargs)
    except ValueError as err:
        raise template.TemplateSyntaxError("`script` tag failed to compile. : {}".format(err))


class ScriptNode(template.Node):
    def __init__(self, nodelist, **kwargs):
        self.nodelist = nodelist
        self.attrs = kwargs

    def _get_value(self, token, context):
        if isinstance(token, six.string_types):
            return token
        if isinstance(token, template.base.FilterExpression):
            return token.resolve(context)
        return None

    def render(self, context):
        request = context.get("request")
        if hasattr(request, "csp_nonce"):
            self.attrs["nonce"] = request.csp_nonce

        content = ""
        attrs = self._render_attrs(context)
        if "src" not in self.attrs:
            content = self.nodelist.render(context).strip()
            content = self._unwrap_content(content)
        return "<script{}>{}</script>".format(attrs, content)

    def _render_attrs(self, context):
        output = []
        for k, v in self.attrs.items():
            value = self._get_value(v, context)
            if value in (True, "True"):
                output.append(" {}".format(k))
            elif value in (None, False, "False"):
                continue
            else:
                output.append(' {}="{}"'.format(k, value))
        output = sorted(output)
        return "".join(output)

    def _unwrap_content(self, text):
        matches = re.search(r"<script[^\>]*>([\s\S]*?)</script>", text)
        if matches:
            return matches.group(1).strip()
        return text
