from __future__ import absolute_import

import zipfile
import pytest
from six import BytesIO

from django.conf import settings
from django.core.urlresolvers import reverse
from django.core.files.uploadedfile import SimpleUploadedFile

from sentry.models import Event
from sentry.testutils import TestCase

PROGUARD_UUID = '6dc7fdb0-d2fb-4c8e-9d6b-bb1aa98929b1'
PROGUARD_SOURCE = b'''\
org.slf4j.helpers.Util$ClassContextSecurityManager -> org.a.b.g$a:
    65:65:void <init>() -> <init>
    67:67:java.lang.Class[] getClassContext() -> a
    69:69:java.lang.Class[] getExtraClassContext() -> a
    65:65:void <init>(org.slf4j.helpers.Util$1) -> <init>
'''
PROGUARD_BUG_UUID = '071207ac-b491-4a74-957c-2c94fd9594f2'
PROGUARD_BUG_SOURCE = b'x'


class BasicResolvingIntegrationTest(TestCase):
    @pytest.mark.skipif(
        settings.SENTRY_TAGSTORE == 'sentry.tagstore.v2.V2TagStorage',
        reason='Queries are completly different when using tagstore'
    )
    def test_basic_resolving(self):
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
        f.writestr('proguard/%s.txt' % PROGUARD_UUID, PROGUARD_SOURCE)
        f.writestr('ignored-file.txt', b'This is just some stuff')
        f.close()

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
            "sentry.interfaces.User": {
                "ip_address": "31.172.207.97"
            },
            "extra": {},
            "project": self.project.id,
            "platform": "java",
            "debug_meta": {
                "images": [{
                    "type": "proguard",
                    "uuid": PROGUARD_UUID,
                }]
            },
            "sentry.interfaces.Exception": {
                "values": [
                    {
                        'stacktrace': {
                            "frames": [
                                {
                                    "function": "a",
                                    "abs_path": None,
                                    "module": "org.a.b.g$a",
                                    "filename": None,
                                    "lineno": 67,
                                },
                                {
                                    "function": "a",
                                    "abs_path": None,
                                    "module": "org.a.b.g$a",
                                    "filename": None,
                                    "lineno": 69,
                                },
                            ]
                        },
                        "type": "RuntimeException",
                        "value": "Shit broke yo"
                    }
                ]
            },
        }

        # We do a preflight post, because there are many queries polluting the array
        # before the actual "processing" happens (like, auth_user)
        self._postWithHeader(event_data)
        with self.assertWriteQueries({
            'nodestore_node': 2,
            'sentry_environmentproject': 1,
            'sentry_eventtag': 1,
            'sentry_eventuser': 1,
            'sentry_filtervalue': 2,
            'sentry_groupedmessage': 1,
            'sentry_message': 1,
            'sentry_messagefiltervalue': 2,
            'sentry_userip': 1,
            'sentry_userreport': 1
        }):
            resp = self._postWithHeader(event_data)
        assert resp.status_code == 200

        event = Event.objects.first()

        bt = event.interfaces['sentry.interfaces.Exception'].values[0].stacktrace
        frames = bt.frames

        assert frames[0].function == 'getClassContext'
        assert frames[0].module == 'org.slf4j.helpers.Util$ClassContextSecurityManager'
        assert frames[1].function == 'getExtraClassContext'
        assert frames[1].module == 'org.slf4j.helpers.Util$ClassContextSecurityManager'

        assert event.culprit == (
            'org.slf4j.helpers.Util$ClassContextSecurityManager '
            'in getExtraClassContext'
        )

    def test_error_on_resolving(self):
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
        f.writestr('proguard/%s.txt' % PROGUARD_BUG_UUID, PROGUARD_BUG_SOURCE)
        f.close()

        response = self.client.post(
            url, {
                'file':
                SimpleUploadedFile('symbols.zip', out.getvalue(),
                                   content_type='application/zip'),
            },
            format='multipart'
        )
        assert response.status_code == 201, response.content
        assert len(response.data) == 1

        event_data = {
            "sentry.interfaces.User": {
                "ip_address": "31.172.207.97"
            },
            "extra": {},
            "project": self.project.id,
            "platform": "java",
            "debug_meta": {
                "images": [{
                    "type": "proguard",
                    "uuid": PROGUARD_BUG_UUID,
                }]
            },
            "sentry.interfaces.Exception": {
                "values": [
                    {
                        'stacktrace': {
                            "frames": [
                                {
                                    "function": "a",
                                    "abs_path": None,
                                    "module": "org.a.b.g$a",
                                    "filename": None,
                                    "lineno": 67,
                                },
                                {
                                    "function": "a",
                                    "abs_path": None,
                                    "module": "org.a.b.g$a",
                                    "filename": None,
                                    "lineno": 69,
                                },
                            ]
                        },
                        "type": "RuntimeException",
                        "value": "Shit broke yo"
                    }
                ]
            },
        }

        resp = self._postWithHeader(event_data)
        assert resp.status_code == 200

        event = Event.objects.get()

        assert len(event.data['errors']) == 1
        assert event.data['errors'][0] == {
            'mapping_uuid': u'071207ac-b491-4a74-957c-2c94fd9594f2',
            'type': 'proguard_missing_lineno',
        }
