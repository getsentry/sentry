from __future__ import absolute_import
import os
import zipfile

from six import BytesIO
from django.core.urlresolvers import reverse
from django.core.files.uploadedfile import SimpleUploadedFile

from sentry.testutils import TestCase
from sentry.lang.native.minidump import MINIDUMP_ATTACHMENT_TYPE
from sentry.lang.native.unreal import process_unreal_crash, unreal_attachment_type, merge_unreal_context_event, merge_unreal_logs_event, merge_apple_crash_report
from sentry.models import Event, EventAttachment, UserReport


MOCK_EVENT_ID = '12852a74acc943a790c8f1cd23907caa'


def get_unreal_crash_file():
    return os.path.join(os.path.dirname(__file__), 'fixtures', 'unreal_crash')


def get_unreal_crash_apple_file():
    return os.path.join(os.path.dirname(__file__), 'fixtures', 'unreal_crash_apple')


def test_process_minidump():
    with open(get_unreal_crash_file(), 'rb') as f:
        unreal_crash = process_unreal_crash(f.read(), None, None, {})
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
            event = {'event_id': MOCK_EVENT_ID}
            user_id = 'ebff51ef3c4878627823eebd9ff40eb4|2e7d369327054a448be6c8d3601213cb|C52DC39D-DAF3-5E36-A8D3-BF5F53A5D38F'
            unreal_crash = process_unreal_crash(f.read(), user_id, 'Production', event)
            merge_unreal_context_event(unreal_crash.get_context(), event, self.project)
            self.insta_snapshot(event)

    def test_merge_unreal_context_event_pcallstack_no_threads(self):
        event = {}
        unreal_context = {
            'runtime_properties': {
                'portable_call_stack': '0x00000000fc440000 + ffffffff PackageA 0x000000003fb70000 + e23831 PackageA 0x000000003fb70000 + 495d7b PackageA 0x000000003fb70000 + 1cbb89',
                'threads': [],
            }
        }
        merge_unreal_context_event(unreal_context, event, self.project)
        assert event.get('threads') is None

    def test_merge_unreal_context_event_without_user(self):
        expected_message = 'user comments'
        context = {
            'runtime_properties': {
                'user_description': expected_message
            }
        }
        event = {'event_id': MOCK_EVENT_ID}
        merge_unreal_context_event(context, event, self.project)

        user_report = UserReport.objects.get(
            event_id=MOCK_EVENT_ID,
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
        event = {'event_id': MOCK_EVENT_ID}
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
        event = {'event_id': MOCK_EVENT_ID}
        merge_unreal_context_event(context, event, self.project)
        try:
            user_report = UserReport.objects.get(
                event_id=MOCK_EVENT_ID,
                project=self.project,
            )
        except UserReport.DoesNotExist:
            user_report = None

        assert user_report is None
        assert event['user']['username'] == expected_username

    def test_merge_unreal_logs_event(self):
        with open(get_unreal_crash_file(), 'rb') as f:
            event = {'event_id': MOCK_EVENT_ID}
            unreal_crash = process_unreal_crash(f.read(), None, None, event)
            merge_unreal_logs_event(unreal_crash.get_logs(), event)
            breadcrumbs = event['breadcrumbs']['values']
            assert len(breadcrumbs) == 100
            assert breadcrumbs[0]['timestamp'] == '2018-11-20T11:47:14Z'
            assert breadcrumbs[0]['message'] == '   4. \'Parallels Display Adapter (WDDM)\' (P:0 D:0)'
            assert breadcrumbs[0]['category'] == 'LogWindows'
            assert breadcrumbs[99]['timestamp'] == '2018-11-20T11:47:15Z'
            assert breadcrumbs[99]['message'] == 'Texture pool size now 1000 MB'
            assert breadcrumbs[99]['category'] == 'LogContentStreaming'

    def test_merge_apple_crash_report(self):
        with open(get_unreal_crash_apple_file(), 'rb') as f:
            event = {'event_id': MOCK_EVENT_ID}
            unreal_crash = process_unreal_crash(f.read(), None, None, event)
            merge_apple_crash_report(unreal_crash.get_apple_crash_report(), event)
            self.insta_snapshot(event)

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
        assert main.instruction_addr == '0x7ff754be3394'

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
