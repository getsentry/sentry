from __future__ import absolute_import
import os
import zipfile
import uuid

from six import BytesIO
from django.core.urlresolvers import reverse
from django.core.files.uploadedfile import SimpleUploadedFile

from sentry.testutils import TestCase
from sentry.lang.native.minidump import MINIDUMP_ATTACHMENT_TYPE
from sentry.lang.native.unreal import process_unreal_crash, unreal_attachment_type, merge_unreal_context_event, merge_unreal_logs_event
from sentry.models import Event, EventAttachment, UserReport


def get_unreal_crash_file():
    return os.path.join(os.path.dirname(__file__), 'fixtures', 'unreal_crash')


def test_process_minidump():
    with open(get_unreal_crash_file(), 'rb') as f:
        unreal_crash = process_unreal_crash(f.read())
        process_state = unreal_crash.process_minidump()
        assert 115 == process_state.module_count
        assert 54 == process_state.thread_count


def test_unreal_attachment_type_minidump():
    file = MockFile("minidump")
    assert unreal_attachment_type(file) == MINIDUMP_ATTACHMENT_TYPE


def test_unreal_attachment_type_unknown():
    file = MockFile("something unknown")
    assert unreal_attachment_type(file) is None


class MockFile(TestCase):
    def __init__(self, type):
        self.type = type


class UnrealIntegrationTest(TestCase):
    def test_merge_unreal_context_event(self):
        with open(get_unreal_crash_file(), 'rb') as f:
            unreal_crash = process_unreal_crash(f.read())
            event = {}
            merge_unreal_context_event(unreal_crash.get_context(), event, self.project)
            assert event['message'] == 'Access violation - code c0000005 (first/second chance not available)'
            assert event['user']['username'] == 'bruno'
            assert event['contexts']['device']['memory_size'] == 6896832512
            assert event['contexts']['os']['name'] == 'Windows 10'
            assert event['contexts']['gpu']['name'] == 'Parallels Display Adapter (WDDM)'
            assert len(event['stacktrace']['frames']) == 20
            assert 'ntdll' == event['stacktrace']['frames'][0]['package']
            assert 'YetAnother' == event['stacktrace']['frames'][2]['package']
            assert 'YetAnother' == event['stacktrace']['frames'][2]['package']

    def test_merge_unreal_context_event_without_user(self):
        expected_message = 'user comments'
        context = {
            'runtime_properties': {
                'user_description': expected_message
            }
        }
        event = {}
        merge_unreal_context_event(context, event, self.project)

        user_report = UserReport.objects.get(
            event_id=event['event_id'],
            project=self.project,
        )
        assert user_report.comments == expected_message
        assert user_report.name == 'unknown'
        assert event.get('user') is None

    def test_merge_unreal_context_event_with_user(self):
        expected_message = 'user comments'
        expected_username = 'John Doe'
        context = {
            'runtime_properties': {
                'username': expected_username,
                'user_description': expected_message
            }
        }
        event = {}
        merge_unreal_context_event(context, event, self.project)

        user_report = UserReport.objects.get(
            event_id=event['event_id'],
            project=self.project,
        )
        assert user_report.comments == expected_message
        assert user_report.name == expected_username
        assert event['user']['username'] == expected_username

    def test_merge_unreal_context_event_without_user_description(self):
        expected_username = 'Jane Doe'
        context = {
            'runtime_properties': {
                'username': expected_username,
            }
        }
        event = {
            'event_id': uuid.uuid4().hex
        }
        merge_unreal_context_event(context, event, self.project)
        try:
            user_report = UserReport.objects.get(
                event_id=event['event_id'],
                project=self.project,
            )
        except UserReport.DoesNotExist:
            user_report = None

        assert user_report is None
        assert event['user']['username'] == expected_username

    def test_merge_unreal_logs_event(self):
        with open(get_unreal_crash_file(), 'rb') as f:
            unreal_crash = process_unreal_crash(f.read())
            event = {}
            merge_unreal_logs_event(unreal_crash.get_logs(), event)
            breadcrumbs = event['breadcrumbs']['values']
            assert len(breadcrumbs) == 100
            assert breadcrumbs[0]['timestamp'] == '2018-11-20T11:47:14Z'
            assert breadcrumbs[0]['message'] == '   4. \'Parallels Display Adapter (WDDM)\' (P:0 D:0)'
            assert breadcrumbs[0]['category'] == 'LogWindows'
            assert breadcrumbs[99]['timestamp'] == '2018-11-20T11:47:15Z'
            assert breadcrumbs[99]['message'] == 'Texture pool size now 1000 MB'
            assert breadcrumbs[99]['category'] == 'LogContentStreaming'

    def upload_symbols(self):
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
        f.write(os.path.join(os.path.dirname(__file__), 'fixtures', 'unreal_crash.sym'),
                'crash.sym')
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

    def test_unreal_crash_with_attachments(self):
        self.project.update_option('sentry:store_crash_reports', True)
        self.upload_symbols()

        # attachments feature has to be on for the files extract stick around
        with self.feature('organizations:event-attachments'):
            with open(os.path.join(os.path.dirname(__file__), 'fixtures', 'unreal_crash'), 'rb') as f:
                resp = self._postUnrealWithHeader(f.read())
                assert resp.status_code == 200

        event = Event.objects.get()

        bt = event.interfaces['exception'].values[0].stacktrace
        frames = bt.frames
        main = frames[-1]
        assert main.errors is None
        assert main.instruction_addr == '0xfd53034'

        attachments = sorted(
            EventAttachment.objects.filter(
                event_id=event.event_id),
            key=lambda x: x.name)
        assert len(attachments) == 4
        context, config, minidump, log = attachments

        assert context.name == 'CrashContext.runtime-xml'
        assert context.file.type == 'event.attachment'
        assert context.file.checksum == '835d3e10db5d1799dc625132c819c047261ddcfb'

        assert config.name == 'CrashReportClient.ini'
        assert config.file.type == 'event.attachment'
        assert config.file.checksum == '5839c750bdde8cba4d2a979ea857b8154cffdab5'

        assert minidump.name == 'UE4Minidump.dmp'
        assert minidump.file.type == 'event.minidump'
        assert minidump.file.checksum == '089d9fd3b5c0cc4426339ab46ec3835e4be83c0f'

        assert log.name == 'YetAnother.log'  # Log file is named after the project
        assert log.file.type == 'event.attachment'
        assert log.file.checksum == '24d1c5f75334cd0912cc2670168d593d5fe6c081'
