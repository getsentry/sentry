from __future__ import absolute_import, unicode_literals

from contextlib import contextmanager
from os.path import normpath
from pprint import pformat

import django
from django import http
from django.conf.urls import url
from django.db.models.query import QuerySet, RawQuerySet
from django.template import Context, RequestContext, Template
from django.test.signals import template_rendered
from django.test.utils import instrumented_test_render
from django.utils.encoding import force_text
from django.utils import six
from django.utils.translation import ugettext_lazy as _

from debug_toolbar.compat import (
    OrderedDict, get_template_dirs, get_template_context_processors)
from debug_toolbar.panels import Panel
from debug_toolbar.panels.sql.tracking import recording, SQLQueryTriggered
from debug_toolbar.panels.templates import views


# Monkey-patch to enable the template_rendered signal. The receiver returns
# immediately when the panel is disabled to keep the overhead small.

# Code taken and adapted from Simon Willison and Django Snippets:
# http://www.djangosnippets.org/snippets/766/

if Template._render != instrumented_test_render:
    Template.original_render = Template._render
    Template._render = instrumented_test_render


# Monkey-patch to store items added by template context processors. The
# overhead is sufficiently small to justify enabling it unconditionally.

if django.VERSION[:2] < (1, 8):

    def _request_context___init__(
            self, request, dict_=None, processors=None, current_app=None,
            use_l10n=None, use_tz=None):
        Context.__init__(
            self, dict_, current_app=current_app,
            use_l10n=use_l10n, use_tz=use_tz)
        if processors is None:
            processors = ()
        else:
            processors = tuple(processors)
        self.context_processors = OrderedDict()
        updates = dict()
        std_processors = get_template_context_processors()
        for processor in std_processors + processors:
            name = '%s.%s' % (processor.__module__, processor.__name__)
            context = processor(request)
            self.context_processors[name] = context
            updates.update(context)
        self.update(updates)

    RequestContext.__init__ = _request_context___init__

else:

    @contextmanager
    def _request_context_bind_template(self, template):
        if self.template is not None:
            raise RuntimeError("Context is already bound to a template")

        self.template = template
        # Set context processors according to the template engine's settings.
        processors = (template.engine.template_context_processors +
                      self._processors)
        self.context_processors = OrderedDict()
        updates = {}
        for processor in processors:
            name = '%s.%s' % (processor.__module__, processor.__name__)
            context = processor(self.request)
            self.context_processors[name] = context
            updates.update(context)
        self.dicts[self._processors_index] = updates

        try:
            yield
        finally:
            self.template = None
            # Unset context processors.
            self.dicts[self._processors_index] = {}

    RequestContext.bind_template = _request_context_bind_template


# Monkey-patch versions of Django where Template doesn't store origin.
# See https://code.djangoproject.com/ticket/16096.

if django.VERSION[:2] < (1, 7):

    old_template_init = Template.__init__

    def new_template_init(self, template_string, origin=None, name='<Unknown Template>'):
        old_template_init(self, template_string, origin, name)
        self.origin = origin

    Template.__init__ = new_template_init


class TemplatesPanel(Panel):
    """
    A panel that lists all templates used during processing of a response.
    """
    def __init__(self, *args, **kwargs):
        super(TemplatesPanel, self).__init__(*args, **kwargs)
        self.templates = []

    def _store_template_info(self, sender, **kwargs):
        template, context = kwargs['template'], kwargs['context']

        # Skip templates that we are generating through the debug toolbar.
        if (isinstance(template.name, six.string_types) and
                template.name.startswith('debug_toolbar/')):
            return

        context_list = []
        for context_layer in context.dicts:
            temp_layer = {}
            if hasattr(context_layer, 'items'):
                for key, value in context_layer.items():
                    # Replace any request elements - they have a large
                    # unicode representation and the request data is
                    # already made available from the Request panel.
                    if isinstance(value, http.HttpRequest):
                        temp_layer[key] = '<<request>>'
                    # Replace the debugging sql_queries element. The SQL
                    # data is already made available from the SQL panel.
                    elif key == 'sql_queries' and isinstance(value, list):
                        temp_layer[key] = '<<sql_queries>>'
                    # Replace LANGUAGES, which is available in i18n context processor
                    elif key == 'LANGUAGES' and isinstance(value, tuple):
                        temp_layer[key] = '<<languages>>'
                    # QuerySet would trigger the database: user can run the query from SQL Panel
                    elif isinstance(value, (QuerySet, RawQuerySet)):
                        model_name = "%s.%s" % (
                            value.model._meta.app_label, value.model.__name__)
                        temp_layer[key] = '<<%s of %s>>' % (
                            value.__class__.__name__.lower(), model_name)
                    else:
                        try:
                            recording(False)
                            pformat(value)  # this MAY trigger a db query
                        except SQLQueryTriggered:
                            temp_layer[key] = '<<triggers database query>>'
                        except UnicodeEncodeError:
                            temp_layer[key] = '<<unicode encode error>>'
                        except Exception:
                            temp_layer[key] = '<<unhandled exception>>'
                        else:
                            temp_layer[key] = value
                        finally:
                            recording(True)
            try:
                context_list.append(pformat(temp_layer))
            except UnicodeEncodeError:
                pass

        kwargs['context'] = [force_text(item) for item in context_list]
        kwargs['context_processors'] = getattr(context, 'context_processors', None)
        self.templates.append(kwargs)

    # Implement the Panel API

    nav_title = _("Templates")

    @property
    def title(self):
        num_templates = len(self.templates)
        return _("Templates (%(num_templates)s rendered)") % {'num_templates': num_templates}

    @property
    def nav_subtitle(self):
        if self.templates:
            return self.templates[0]['template'].name
        return ''

    template = 'debug_toolbar/panels/templates.html'

    @classmethod
    def get_urls(cls):
        return [
            url(r'^template_source/$', views.template_source, name='template_source'),
        ]

    def enable_instrumentation(self):
        template_rendered.connect(self._store_template_info)

    def disable_instrumentation(self):
        template_rendered.disconnect(self._store_template_info)

    def process_response(self, request, response):
        template_context = []
        for template_data in self.templates:
            info = {}
            # Clean up some info about templates
            template = template_data.get('template', None)
            if hasattr(template, 'origin') and template.origin and template.origin.name:
                template.origin_name = template.origin.name
            else:
                template.origin_name = _('No origin')
            info['template'] = template
            # Clean up context for better readability
            if self.toolbar.config['SHOW_TEMPLATE_CONTEXT']:
                context_list = template_data.get('context', [])
                info['context'] = '\n'.join(context_list)
            template_context.append(info)

        # Fetch context_processors from any template
        if self.templates:
            context_processors = self.templates[0]['context_processors']
        else:
            context_processors = None

        template_dirs = get_template_dirs()

        self.record_stats({
            'templates': template_context,
            'template_dirs': [normpath(x) for x in template_dirs],
            'context_processors': context_processors,
        })
