from django.template.base import Library

from ..compat import url as url_compat

register = Library()


@register.tag
def url(parser, token):
    return url_compat(parser, token)
