from __future__ import absolute_import, unicode_literals

from django.http import HttpResponseBadRequest
from django.shortcuts import render_to_response
from django.template import TemplateDoesNotExist
from django.utils.safestring import mark_safe

from debug_toolbar.compat import get_template_loaders


def template_source(request):
    """
    Return the source of a template, syntax-highlighted by Pygments if
    it's available.
    """
    template_name = request.GET.get('template', None)
    if template_name is None:
        return HttpResponseBadRequest('"template" key is required')

    final_loaders = []
    loaders = get_template_loaders()

    for loader in loaders:
        if loader is not None:
            # When the loader has loaders associated with it,
            # append those loaders to the list. This occurs with
            # django.template.loaders.cached.Loader
            if hasattr(loader, 'loaders'):
                final_loaders += loader.loaders
            else:
                final_loaders.append(loader)

    for loader in final_loaders:
        try:
            source, display_name = loader.load_template_source(template_name)
            break
        except TemplateDoesNotExist:
            source = "Template Does Not Exist: %s" % (template_name,)

    try:
        from pygments import highlight
        from pygments.lexers import HtmlDjangoLexer
        from pygments.formatters import HtmlFormatter

        source = highlight(source, HtmlDjangoLexer(), HtmlFormatter())
        source = mark_safe(source)
        source.pygmentized = True
    except ImportError:
        pass

    # Using render_to_response avoids running global context processors.
    return render_to_response('debug_toolbar/panels/template_source.html', {
        'source': source,
        'template_name': template_name
    })
