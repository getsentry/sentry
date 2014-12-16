from __future__ import absolute_import

import textwrap

from django.contrib.admindocs.views import simplify_regex

from django.utils.importlib import import_module

from sentry.api.base import Endpoint
from sentry.constants import HTTP_METHODS
from sentry.web.frontend.base import BaseView


class ApiHelpBase(BaseView):
    auth_required = False

    def get_resources(self, section, prefix='/api/0/'):
        urls = import_module('sentry.api.urls')

        resources = []
        for pattern in urls.urlpatterns:
            callback = self.__get_resource_callback(pattern, prefix)
            if callback is None:
                continue
            if getattr(callback, 'doc_section', None) != section:
                continue
            data = self.__get_resource_data(pattern, prefix, callback)
            resources.append(data)
        return sorted(resources, key=lambda x: x['path'])

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

    def __strip_doc(self, doc):
        return textwrap.dedent(doc).strip()

    def __split_doc(self, doc, path):
        if doc:
            try:
                title, doc = doc.split('\n', 1)
            except ValueError:
                title, doc = doc, ''
        else:
            title = ''

        return title.strip(), doc.strip()

    def __format_doc(self, doc, params):
        return doc.format(**params)

    def __get_resource_callback(self, pattern, prefix):
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

        return callback

    def __get_resource_data(self, pattern, prefix, callback):
        path = simplify_regex(pattern.regex.pattern)
        path = path.replace('<', '{').replace('>', '}')

        full_path = prefix.rstrip('/') + path

        methods = []
        for method_name in HTTP_METHODS:
            if method_name == 'OPTIONS':
                continue
            method = getattr(callback, method_name.lower(), None)
            if method is None:
                continue

            title, docstring = self.__split_doc(
                self.__strip_doc(method.__doc__ or ''), path=path)

            methods.append({
                'name': method_name,
                'title': title or '{} {}'.format(method_name, path),
                'doc': self.__format_doc(docstring, {
                    'path': full_path,
                    'method': method_name,
                }),
            })

        return {
            'path': full_path,
            'methods': methods,
            'section': getattr(callback, 'doc_section', None),
        }
