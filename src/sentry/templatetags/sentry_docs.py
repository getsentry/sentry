from __future__ import absolute_import, print_function

from django import template

from sentry.api.base import DocSection
from sentry.models import HelpPage

register = template.Library()


@register.inclusion_tag('sentry/help/sidebar.html', takes_context=True)
def render_doc_sidebar(context):
    api_sections = sorted(
        ({'id': v.name.lower(), 'name': v.value} for v in DocSection),
        key=lambda x: x['name'])

    pages = list(HelpPage.objects.filter(is_visible=True))
    pages.sort(key=lambda x: (-x.priority, x.title))

    return {
        'api_sections': api_sections,
        'page_list': pages,
    }
