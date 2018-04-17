from __future__ import absolute_import

import zipfile
from six import BytesIO, text_type

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
from sentry.models import VersionDSymFile

# This is obviously a freely generated UUID and not the checksum UUID.
# This is permissible if users want to send different UUIDs
PROGUARD_UUID = '6dc7fdb0-d2fb-4c8e-9d6b-bb1aa98929b1'
PROGUARD_SOURCE = b'''\
org.slf4j.helpers.Util$ClassContextSecurityManager -> org.a.b.g$a:
65:65:void <init>() -> <init>
67:67:java.lang.Class[] getClassContext() -> getClassContext
65:65:void <init>(org.slf4j.helpers.Util$1) -> <init>
'''


class DSymFilesUploadTest(APITestCase):
    def test_simple_proguard_upload(self):
        project = self.create_project(name='foo')

        url = reverse(
            'sentry-api-0-dsym-files',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
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
                SimpleUploadedFile('symbols.zip', out.getvalue(),
                                   content_type='application/zip'),
            },
            format='multipart'
        )

        assert response.status_code == 201, response.content
        assert len(response.data) == 1
        assert response.data[0]['headers'] == {
            'Content-Type': 'text/x-proguard+plain'}
        assert response.data[0]['sha1'] == 'e6d3c5185dac63eddfdc1a5edfffa32d46103b44'
        assert response.data[0]['uuid'] == PROGUARD_UUID
        assert response.data[0]['objectName'] == 'proguard-mapping'
        assert response.data[0]['cpuName'] == 'any'
        assert response.data[0]['symbolType'] == 'proguard'

    def test_associate_proguard_dsym(self):
        project = self.create_project(name='foo')

        url = reverse(
            'sentry-api-0-dsym-files',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )

        self.login_as(user=self.user)

        out = BytesIO()
        f = zipfile.ZipFile(out, 'w')
        f.writestr('proguard/%s.txt' % PROGUARD_UUID, PROGUARD_SOURCE)
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
        assert response.data[0]['headers'] == {
            'Content-Type': 'text/x-proguard+plain'}
        assert response.data[0]['sha1'] == 'e6d3c5185dac63eddfdc1a5edfffa32d46103b44'
        assert response.data[0]['uuid'] == PROGUARD_UUID
        assert response.data[0]['objectName'] == 'proguard-mapping'
        assert response.data[0]['cpuName'] == 'any'
        assert response.data[0]['symbolType'] == 'proguard'

        url = reverse(
            'sentry-api-0-associate-dsym-files',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )

        response = self.client.post(
            url, {
                'checksums': ['e6d3c5185dac63eddfdc1a5edfffa32d46103b44'],
                'platform': 'android',
                'name': 'MyApp',
                'appId': 'com.example.myapp',
                'version': '1.0',
                'build': '1',
            },
            format='json'
        )

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data['associatedDsymFiles'][0]['uuid'] == PROGUARD_UUID

        vdf = VersionDSymFile.objects.get()
        assert vdf.version == '1.0'
        assert vdf.build == '1'
        assert vdf.dsym_app.app_id == 'com.example.myapp'
        assert vdf.dsym_file.debug_id == PROGUARD_UUID

    def test_associate_proguard_dsym_no_build(self):
        project = self.create_project(name='foo')

        url = reverse(
            'sentry-api-0-dsym-files',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )

        self.login_as(user=self.user)

        out = BytesIO()
        f = zipfile.ZipFile(out, 'w')
        f.writestr('proguard/%s.txt' % PROGUARD_UUID, PROGUARD_SOURCE)
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
        assert response.data[0]['headers'] == {
            'Content-Type': 'text/x-proguard+plain'}
        assert response.data[0]['sha1'] == 'e6d3c5185dac63eddfdc1a5edfffa32d46103b44'
        assert response.data[0]['uuid'] == PROGUARD_UUID
        assert response.data[0]['objectName'] == 'proguard-mapping'
        assert response.data[0]['cpuName'] == 'any'
        assert response.data[0]['symbolType'] == 'proguard'

        url = reverse(
            'sentry-api-0-associate-dsym-files',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )

        response = self.client.post(
            url, {
                'checksums': ['e6d3c5185dac63eddfdc1a5edfffa32d46103b44'],
                'platform': 'android',
                'name': 'MyApp',
                'appId': 'com.example.myapp',
                'version': '1.0',
            },
            format='json'
        )

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data['associatedDsymFiles'][0]['uuid'] == PROGUARD_UUID

        vdf = VersionDSymFile.objects.get()
        assert vdf.version == '1.0'
        assert vdf.build is None
        assert vdf.dsym_app.app_id == 'com.example.myapp'
        assert vdf.dsym_file.debug_id == PROGUARD_UUID

    def test_dsyms_requests(self):
        project = self.create_project(name='foo')

        url = reverse(
            'sentry-api-0-dsym-files',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )

        self.login_as(user=self.user)

        out = BytesIO()
        f = zipfile.ZipFile(out, 'w')
        f.writestr('proguard/%s.txt' % PROGUARD_UUID, PROGUARD_SOURCE)
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

        url = reverse(
            'sentry-api-0-associate-dsym-files',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )

        response = self.client.post(
            url, {
                'checksums': ['e6d3c5185dac63eddfdc1a5edfffa32d46103b44'],
                'platform': 'android',
                'name': 'MyApp',
                'appId': 'com.example.myapp',
                'version': '1.0',
                'build': '1',
            },
            format='json'
        )

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data['associatedDsymFiles'][0]['uuid'] == PROGUARD_UUID
        download_id = response.data['associatedDsymFiles'][0]['id']

        url = reverse(
            'sentry-api-0-dsym-files',
            kwargs={
                'organization_slug': project.organization.slug,
                'project_slug': project.slug,
            }
        )

        response = self.client.get(url)

        assert response.status_code == 200, response.content

        app, = response.data['apps']
        assert app['appId'] == 'com.example.myapp'
        assert app['iconUrl'] is None
        assert app['name'] == 'MyApp'
        assert app['platform'] == 'android'

        dsym, = response.data['debugSymbols']
        assert dsym['build'] == '1'
        assert dsym['version'] == '1.0'
        assert dsym['dsym']['cpuName'] == 'any'
        assert dsym['dsym']['headers'] == {
            'Content-Type': 'text/x-proguard+plain'}
        assert dsym['dsym']['objectName'] == 'proguard-mapping'
        assert dsym['dsym']['sha1'] == 'e6d3c5185dac63eddfdc1a5edfffa32d46103b44'
        assert dsym['dsym']['symbolType'] == 'proguard'
        assert dsym['dsym']['uuid'] == '6dc7fdb0-d2fb-4c8e-9d6b-bb1aa98929b1'

        assert response.data['unreferencedDebugSymbols'] == []

        # Test download
        response = self.client.get(url + "?download_id=" + download_id)

        assert response.status_code == 200, response.content
        assert response.get(
            'Content-Disposition') == 'attachment; filename="' + PROGUARD_UUID + '.txt"'
        assert response.get(
            'Content-Length') == text_type(len(PROGUARD_SOURCE))
        assert response.get('Content-Type') == 'application/octet-stream'
        assert PROGUARD_SOURCE == BytesIO(
            b"".join(response.streaming_content)).getvalue()

        # Login user with no permissions
        user_no_permission = self.create_user('baz@localhost', username='baz')
        self.login_as(user=user_no_permission)
        response = self.client.get(url + "?download_id=" + download_id)
        assert response.status_code == 403, response.content
