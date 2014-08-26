from django import template

from sentry.api.base import DocSection

register = template.Library()


@register.inclusion_tag('sentry/help/sidebar.html', takes_context=True)
def render_doc_sidebar(context):
    api_sections = sorted(((v.name, v.value) for v in DocSection),
                          key=lambda x: x[1])

    return {
        'api_sections': api_sections,
    }
