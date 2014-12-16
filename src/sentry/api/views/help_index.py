from __future__ import absolute_import

from django.contrib.admindocs.views import simplify_regex
from django.utils.importlib import import_module
from django.views.generic import View

from sentry.api.base import Endpoint
from sentry.web.helpers import render_to_response

METHODS = ('get', 'post', 'delete', 'patch')


class ApiHelpIndexView(View):

    def get(self, request):
        prefix = '/api/0/'

        context = {
            'section_list': self.get_sections(prefix)
        }

        return render_to_response('sentry/help/api_index.html', context, request)

    def get_sections(self, prefix=''):
        resource_list = sorted(
            (r for r in self.get_resources(prefix) if r['section']),
            key=lambda x: x['section'].value,
        )

        section_list = []
        last_section = None
        for resource in resource_list:
            if resource['section'] != last_section:
                section_list.append({
                    'id': resource['section'].name,
                    'name': resource['section'].value,
                    'resources': [],
                })
            section_list[-1]['resources'].append(resource)
            last_section = resource['section']

        return section_list

    def get_resources(self, prefix=''):
        urls = import_module('sentry.api.urls')

        resources = []
        for pattern in urls.urlpatterns:
            data = self.__get_resource_data(pattern, prefix)
            if data is None:
                continue
            resources.append(data)
        return sorted(resources, key=lambda x: x['path'])

    def __strip_doc(self, doc):
        return doc.strip()

    def __split_doc(self, doc, path):
        if doc:
            try:
                title, doc = doc.split('\n', 1)
            except ValueError:
                title, doc = doc, ''
        else:
            title = path

        return title.strip(), doc.strip()

    def __get_resource_data(self, pattern, prefix):
        if not hasattr(pattern, 'callback'):
            return

        if hasattr(pattern.callback, 'cls'):
            callback = pattern.callback.cls

            if not issubclass(callback, Endpoint):
                return
        elif hasattr(pattern.callback, 'cls_instance'):
            callback = pattern.callback.cls_instance

            if not isinstance(callback, Endpoint):
                return
        else:
            return

        path = simplify_regex(pattern.regex.pattern)

        path = path.replace('<', '{').replace('>', '}')

        methods = []
        for method_name in METHODS:
            method = getattr(callback, method_name, None)
            if method is None:
                continue
            methods.append({
                'name': method_name,
                'doc': self.__strip_doc(method.__doc__ or ''),
            })

        title, docstring = self.__split_doc(
            self.__strip_doc(callback.__doc__ or ''), path=path)

        return {
            'path': prefix.rstrip('/') + path,
            'methods': methods,
            'doc': docstring,
            'title': title,
            'section': getattr(callback, 'doc_section', None),
        }
