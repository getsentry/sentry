from __future__ import absolute_import

import zipfile
from six import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.urlresolvers import reverse

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


class BasicResolvingIntegrationTest(TestCase):

    def test_basic_resolving(self):
        url = reverse('sentry-api-0-dsym-files', kwargs={
            'organization_slug': self.project.organization.slug,
            'project_slug': self.project.slug,
        })

        self.login_as(user=self.user)

        out = BytesIO()
        f = zipfile.ZipFile(out, 'w')
        f.writestr('proguard/%s.txt' % PROGUARD_UUID, PROGUARD_SOURCE)
        f.writestr('ignored-file.txt', b'This is just some stuff')
        f.close()

        response = self.client.post(url, {
            'file': SimpleUploadedFile('symbols.zip', out.getvalue(),
                                       content_type='application/zip'),
        }, format='multipart')
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
                "images": [
                    {
                        "type": "proguard",
                        "uuid": PROGUARD_UUID,
                    }
                ]
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
