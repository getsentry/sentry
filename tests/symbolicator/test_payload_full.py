from __future__ import absolute_import

import os
import pytest
import zipfile
from mock import patch

from six import BytesIO

from django.core.urlresolvers import reverse
from django.core.files.uploadedfile import SimpleUploadedFile

from sentry.testutils import TestCase, TransactionTestCase
from sentry.models import Event, File, ProjectDebugFile

from symbolic import SymbolicError, SymCache

from tests.symbolicator import insta_snapshot_stacktrace_data

REAL_RESOLVING_EVENT_DATA = {
    "platform": "cocoa",
    "debug_meta": {
        "images": [{
            "type": "apple",
            "arch": "x86_64",
            "uuid": "502fc0a5-1ec1-3e47-9998-684fa139dca7",
            "image_vmaddr": "0x0000000100000000",
            "image_size": 4096,
            "image_addr": "0x0000000100000000",
            "name": "Foo.app/Contents/Foo"
        }],
        "sdk_info": {
            "dsym_type": "macho",
            "sdk_name": "macOS",
            "version_major": 10,
            "version_minor": 12,
            "version_patchlevel": 4,
        }
    },
    "exception": {
        "values": [
            {
                'stacktrace': {
                    "frames": [
                        {
                            "function": "unknown",
                            "instruction_addr": "0x0000000100000fa0"
                        },
                    ]
                },
                "type": "Fail",
                "value": "fail"
            }
        ]
    },
}


class ResolvingIntegrationTestBase(object):
    def test_real_resolving(self):
        url = reverse(
            'sentry-api-0-dsym-files',
            kwargs={
                'organization_slug': self.project.organization.slug,
                'project_slug': self.project.slug,
            }
        )

        self.login_as(user=self.user)

        out = BytesIO()
        f = zipfile.ZipFile(out, 'w')
        f.write(os.path.join(os.path.dirname(__file__), 'fixtures', 'hello.dsym'),
                'dSYM/hello')
        f.close()

        response = self.client.post(
            url, {
                'file':
                SimpleUploadedFile('symbols.zip', out.getvalue(), content_type='application/zip'),
            },
            format='multipart'
        )
        assert response.status_code == 201, response.content
        assert len(response.data) == 1

        resp = self._postWithHeader(dict(project=self.project.id, **REAL_RESOLVING_EVENT_DATA))
        assert resp.status_code == 200

        event = Event.objects.get()
        assert event.data['culprit'] == 'main'
        insta_snapshot_stacktrace_data(self, event.data)

    def test_debug_id_resolving(self):
        file = File.objects.create(
            name='crash.pdb',
            type='default',
            headers={'Content-Type': 'text/x-breakpad'},
        )

        path = os.path.join(os.path.dirname(__file__), 'fixtures', 'windows.sym')
        with open(path) as f:
            file.putfile(f)

        ProjectDebugFile.objects.create(
            file=file,
            object_name='crash.pdb',
            cpu_name='x86',
            project=self.project,
            debug_id='3249d99d-0c40-4931-8610-f4e4fb0b6936-1',
            code_id='5AB380779000',
        )

        self.login_as(user=self.user)

        event_data = {
            'contexts': {
                'device': {
                    'arch': 'x86'
                },
                'os': {
                    'build': u'',
                    'name': 'Windows',
                    'type': 'os',
                    'version': u'10.0.14393'
                }
            },
            'debug_meta': {
                'images': [
                    {
                        'id': u'3249d99d-0c40-4931-8610-f4e4fb0b6936-1',
                        'image_addr': '0x2a0000',
                        'image_size': 36864,
                        'name': u'C:\\projects\\breakpad-tools\\windows\\Release\\crash.exe',
                        'type': 'symbolic'
                    }
                ]
            },
            'exception': {
                'stacktrace': {
                    'frames': [
                        {
                            'function': '<unknown>',
                            'instruction_addr': '0x2a2a3d',
                            'package': u'C:\\projects\\breakpad-tools\\windows\\Release\\crash.exe'
                        }
                    ]
                },
                'thread_id': 1636,
                'type': u'EXCEPTION_ACCESS_VIOLATION_WRITE',
                'value': u'Fatal Error: EXCEPTION_ACCESS_VIOLATION_WRITE'
            },
            'platform': 'native'
        }

        resp = self._postWithHeader(event_data)
        assert resp.status_code == 200

        event = Event.objects.get()
        assert event.data['culprit'] == 'main'
        insta_snapshot_stacktrace_data(self, event.data)

    def test_missing_dsym(self):
        self.login_as(user=self.user)

        resp = self._postWithHeader(dict(project=self.project.id, **REAL_RESOLVING_EVENT_DATA))
        assert resp.status_code == 200

        event = Event.objects.get()
        assert event.data['culprit'] == 'unknown'
        insta_snapshot_stacktrace_data(self, event.data)


class SymbolicResolvingIntegrationTest(ResolvingIntegrationTestBase, TestCase):
    @pytest.fixture(autouse=True)
    def inject_pytest_monkeypatch(self, monkeypatch):
        self.pytest_monkeypatch = monkeypatch

    def test_broken_conversion(self):
        url = reverse(
            'sentry-api-0-dsym-files',
            kwargs={
                'organization_slug': self.project.organization.slug,
                'project_slug': self.project.slug,
            }
        )

        self.login_as(user=self.user)

        out = BytesIO()
        f = zipfile.ZipFile(out, 'w')
        f.write(os.path.join(os.path.dirname(__file__), 'fixtures', 'hello.dsym'),
                'dSYM/hello')
        f.close()

        @classmethod
        def broken_make_symcache(cls, obj):
            raise SymbolicError('shit on fire')

        self.pytest_monkeypatch.setattr(SymCache, 'from_object', broken_make_symcache)

        response = self.client.post(
            url, {
                'file':
                SimpleUploadedFile(
                    'symbols.zip',
                    out.getvalue(),
                    content_type='application/zip'),
            },
            format='multipart'
        )
        assert response.status_code == 201, response.content
        assert len(response.data) == 1

        event_data = {
            "project": self.project.id,
            "platform": "cocoa",
            "debug_meta": {
                "images": [{
                    "type": "apple",
                    "arch": "x86_64",
                    "uuid": "502fc0a5-1ec1-3e47-9998-684fa139dca7",
                    "image_vmaddr": "0x0000000100000000",
                    "image_size": 4096,
                    "image_addr": "0x0000000100000000",
                    "name": "Foo.app/Contents/Foo"
                }],
                "sdk_info": {
                    "dsym_type": "macho",
                    "sdk_name": "macOS",
                    "version_major": 10,
                    "version_minor": 12,
                    "version_patchlevel": 4,
                }
            },
            "exception": {
                "values": [
                    {
                        'stacktrace': {
                            "frames": [
                                {
                                    "function": "unknown",
                                    "instruction_addr": "0x0000000100000fa0"
                                },
                            ]
                        },
                        "type": "Fail",
                        "value": "fail"
                    }
                ]
            },
        }

        for _ in range(3):
            resp = self._postWithHeader(event_data)
            assert resp.status_code == 200
            event = Event.objects.get(project_id=self.project.id)
            errors = event.data['errors']
            assert len(errors) == 1
            assert errors[0] == {
                'image_arch': u'x86_64',
                'image_path': u'Foo.app/Contents/Foo',
                'image_uuid': u'502fc0a5-1ec1-3e47-9998-684fa139dca7',
                'message': u'shit on fire',
                'type': 'native_bad_dsym'
            }
            event.delete()


class SymbolicatorResolvingIntegrationTest(ResolvingIntegrationTestBase, TransactionTestCase):
    # For these tests to run, write `symbolicator.enabled: true` into your
    # `~/.sentry/config.yml` and run `sentry devservices up`

    @pytest.fixture(autouse=True)
    def initialize(self, live_server):
        new_prefix = live_server.url

        with patch('sentry.lang.native.symbolizer.Symbolizer._symbolize_app_frame') \
            as symbolize_app_frame, \
                patch('sentry.lang.native.plugin._is_symbolicator_enabled', return_value=True), \
                patch('sentry.auth.system.is_internal_ip', return_value=True), \
                self.options({"system.url-prefix": new_prefix}):

            # Run test case:
            yield

            # Teardown:
            assert not symbolize_app_frame.called
