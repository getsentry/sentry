from __future__ import absolute_import

import copy
import mock
import os

from symbolic import CFICACHE_LATEST_VERSION

from sentry.attachments import CachedAttachment
from sentry.lang.native.cfi import reprocess_minidump_with_cfi
from sentry.lang.native.minidump import MINIDUMP_ATTACHMENT_TYPE
from sentry.models import ProjectCfiCacheFile
from sentry.testutils import TestCase

RAW_STACKTRACE = [
    {
        'function': '<unknown>',
        'instruction_addr': '0x7f51401e4800',
        'package': u'/lib/x86_64-linux-gnu/libc-2.23.so',
        'trust': 'scan',
    },
    {
        'function': '<unknown>',
        'instruction_addr': '0x7f514025002e',
        'package': u'/lib/x86_64-linux-gnu/libc-2.23.so',
        'trust': 'scan',
    },
    {
        'function': '<unknown>',
        'instruction_addr': '0x401d72',
        'package': u'/work/linux/build/crash',
        'trust': 'context',
    }
]

CFI_STACKTRACE = [
    {
        'function': '<unknown>',
        'instruction_addr': '0x401dc0',
        'package': u'/work/linux/build/crash',
        'trust': 'scan'
    },
    {
        'function': '<unknown>',
        'instruction_addr': '0x7f5140cdc000',
        'package': None,
        'trust': 'scan'
    },
    {
        'function': '<unknown>',
        'instruction_addr': '0x400040',
        'package': u'/work/linux/build/crash',
        'trust': 'scan'
    },
    {
        'function': '<unknown>',
        'instruction_addr': '0x7fff5aef1000',
        'package': None,
        'trust': 'scan'
    },
    {
        'function': '<unknown>',
        'instruction_addr': '0x7fff5ae4ac88',
        'package': None,
        'trust': 'cfi'
    },
    {
        'function': '<unknown>',
        'instruction_addr': '0x401de9',
        'package': u'/work/linux/build/crash',
        'trust': 'scan'
    },
    {
        'function': '<unknown>',
        'instruction_addr': '0x401dc0',
        'package': u'/work/linux/build/crash',
        'trust': 'scan'
    },
    {
        'function': '<unknown>',
        'instruction_addr': '0x414ca0',
        'package': u'/work/linux/build/crash',
        'trust': 'scan'
    },
    {
        'function': '<unknown>',
        'instruction_addr': '0x401c70',
        'package': u'/work/linux/build/crash',
        'trust': 'scan'
    },
    {
        'function': '<unknown>',
        'instruction_addr': '0x401dc0',
        'package': u'/work/linux/build/crash',
        'trust': 'scan'
    },
    {
        'function': '<unknown>',
        'instruction_addr': '0x401c70',
        'package': u'/work/linux/build/crash',
        'trust': 'scan'
    },
    {
        'function': '<unknown>',
        'instruction_addr': '0x7f514017d830',
        'package': u'/lib/x86_64-linux-gnu/libc-2.23.so',
        'trust': 'cfi'
    },
    {
        'function': '<unknown>',
        'instruction_addr': '0x401d72',
        'package': u'/work/linux/build/crash',
        'trust': 'context',
    }
]

CFI_CACHE = [
    ('c0bcc3f1-9827-fe65-3058-404b2831d9e6', '0x1dc0', 'scan'),
    (None, '0x7f5140cdc000', 'scan'),
    ('c0bcc3f1-9827-fe65-3058-404b2831d9e6', '0x40', 'scan'),
    (None, '0x7fff5aef1000', 'scan'),
    (None, '0x7fff5ae4ac88', 'cfi'),
    ('c0bcc3f1-9827-fe65-3058-404b2831d9e6', '0x1de9', 'scan'),
    ('c0bcc3f1-9827-fe65-3058-404b2831d9e6', '0x1dc0', 'scan'),
    ('c0bcc3f1-9827-fe65-3058-404b2831d9e6', '0x14ca0', 'scan'),
    ('c0bcc3f1-9827-fe65-3058-404b2831d9e6', '0x1c70', 'scan'),
    ('c0bcc3f1-9827-fe65-3058-404b2831d9e6', '0x1dc0', 'scan'),
    ('c0bcc3f1-9827-fe65-3058-404b2831d9e6', '0x1c70', 'scan'),
    ('451a38b5-0679-79d2-0738-22a5ceb24c4b', '0x20830', 'cfi'),
    ('c0bcc3f1-9827-fe65-3058-404b2831d9e6', '0x1d72', 'context'),
]


class CfiReprocessingTest(TestCase):
    def mock_attachments(self):
        path = os.path.join(os.path.dirname(__file__), 'fixtures', 'linux.dmp')
        with open(path, 'rb') as minidump:
            data = minidump.read()

        return [CachedAttachment(data=data, type=MINIDUMP_ATTACHMENT_TYPE)]

    def get_mock_event(self, reprocessed=False):
        stacktrace = CFI_STACKTRACE if reprocessed else RAW_STACKTRACE
        return copy.deepcopy({
            'event_id': '9dac1e3a7ea043818ba6f0685e258c09',
            'project': self.project.id,
            'platform': 'native',
            'debug_meta': {
                'images': [
                    {
                        'id': u'c0bcc3f1-9827-fe65-3058-404b2831d9e6',
                        'image_addr': '0x400000',
                        'image_size': 106496,
                        'name': u'/work/linux/build/crash',
                        'type': 'symbolic'
                    },
                    {
                        'id': u'451a38b5-0679-79d2-0738-22a5ceb24c4b',
                        'image_addr': '0x7f514015d000',
                        'image_size': 1835008,
                        'name': u'/lib/x86_64-linux-gnu/libc-2.23.so',
                        'type': 'symbolic'
                    },
                ]
            },
            'exception': {
                'values': [
                    {
                        'mechanism': {
                            'type': 'minidump',
                            'handled': False
                        },
                        'stacktrace': {
                            'frames': stacktrace,
                        },
                        'thread_id': 1304,
                    }
                ]
            },
            'threads': {
                'values': [
                    {
                        'crashed': True,
                        'id': 1304
                    }
                ]
            },
        })

    @mock.patch('sentry.attachments.base.BaseAttachmentCache.get', return_value=None)
    @mock.patch('sentry.utils.cache.cache.get', return_value=None)
    def test_cfi_reprocessing_no_minidump(self, mock_cache_get, mock_attachment_get):
        data = self.get_mock_event(reprocessed=False)
        result = reprocess_minidump_with_cfi(data)

        # mock_cache_get.assert_called_with('st:86e3a22f05a287eeeca681ecbeef3067')
        cache_key = 'e:9dac1e3a7ea043818ba6f0685e258c09:%s' % self.project.id
        mock_attachment_get.assert_called_once_with(cache_key)
        assert result is None

    @mock.patch('sentry.attachments.base.BaseAttachmentCache.get')
    def test_cfi_reprocessing_no_cfi_caches(self, mock_attachment_get):
        mock_attachment_get.return_value = self.mock_attachments()

        data = self.get_mock_event(reprocessed=False)
        result = reprocess_minidump_with_cfi(data)

        assert result is None

    @mock.patch('sentry.attachments.base.BaseAttachmentCache.get', return_value=None)
    @mock.patch('sentry.utils.cache.cache.get', return_value=None)
    def test_cfi_reprocessing_no_scanned_frames(self, mock_cache_get, mock_attachment_get):
        data = self.get_mock_event(reprocessed=False)
        for frame in data['exception']['values'][0]['stacktrace']['frames']:
            if frame['trust'] == 'scan':
                frame['trust'] = 'cfi'
        result = reprocess_minidump_with_cfi(data)

        assert mock_cache_get.call_count == 0
        assert mock_attachment_get.call_count == 0
        assert result is None

    @mock.patch('sentry.attachments.base.BaseAttachmentCache.get', return_value=None)
    @mock.patch('sentry.utils.cache.cache.get', return_value=None)
    def test_cfi_reprocessing_cached(self, mock_cache_get, mock_attachment_get):
        mock_cache_get.return_value = CFI_CACHE

        data = self.get_mock_event(reprocessed=False)
        result = reprocess_minidump_with_cfi(data)

        mock_cache_get.assert_called_once_with('st:b4eeed5c7008d0003cc5549c36dba6b7')
        assert mock_attachment_get.call_count == 0
        assert result == self.get_mock_event(reprocessed=True)

    @mock.patch('sentry.attachments.base.BaseAttachmentCache.get', return_value=None)
    @mock.patch('sentry.utils.cache.cache.get', return_value=None)
    def test_cfi_unchanged(self, mock_cache_get, mock_attachment_get):
        mock_cache_get.return_value = '__no_cfi__'

        data = self.get_mock_event(reprocessed=False)
        result = reprocess_minidump_with_cfi(data)

        mock_cache_get.assert_called_once_with('st:b4eeed5c7008d0003cc5549c36dba6b7')
        assert mock_attachment_get.call_count == 0
        assert result is None

    @mock.patch('sentry.attachments.base.BaseAttachmentCache.get', return_value=None)
    @mock.patch('sentry.utils.cache.cache.get', return_value=None)
    def test_cfi_missing_stacktrace(self, mock_cache_get, mock_attachment_get):
        data = {
            'exception': {
                'values': [
                    {
                        'stacktrace': None,
                    }
                ]
            },
        }
        result = reprocess_minidump_with_cfi(data)

        assert mock_cache_get.call_count == 0
        assert mock_attachment_get.call_count == 0
        assert result is None

    @mock.patch('sentry.attachments.base.BaseAttachmentCache.get', return_value=None)
    @mock.patch('sentry.utils.cache.cache.set', return_value=None)
    @mock.patch('sentry.utils.cache.cache.get', return_value=None)
    def test_cfi_reprocessing(self, mock_cache_get, mock_cache_set, mock_attachment_get):
        dif = self.create_dif_file(
            debug_id='c0bcc3f1-9827-fe65-3058-404b2831d9e6',
            features=['unwind']
        )

        cache_file = self.create_file_from_path(
            path=os.path.join(os.path.dirname(__file__), 'fixtures', 'linux.cficache'),
            type='project.cficache'
        )

        ProjectCfiCacheFile.objects.create(
            project=self.project,
            cache_file=cache_file,
            debug_file=dif,
            checksum=dif.file.checksum,
            version=CFICACHE_LATEST_VERSION,
        )

        mock_attachment_get.return_value = self.mock_attachments()
        data = self.get_mock_event(reprocessed=False)
        result = reprocess_minidump_with_cfi(data)

        cache_key = 'e:9dac1e3a7ea043818ba6f0685e258c09:%s' % self.project.id
        mock_attachment_get.assert_called_once_with(cache_key)
        mock_cache_set.assert_called_with('st:b4eeed5c7008d0003cc5549c36dba6b7', CFI_CACHE)

        assert result == self.get_mock_event(reprocessed=True)
