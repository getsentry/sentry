from __future__ import absolute_import
import os

from sentry.lang.native.minidump import MINIDUMP_ATTACHMENT_TYPE
from sentry.lang.native.unreal import process_unreal_crash, unreal_attachment_type


def test_process_minidump():
    minidump = os.path.join(os.path.dirname(__file__), 'fixtures', 'unreal_crash')
    with open(minidump, 'rb') as f:
        minidump = process_unreal_crash(f.read())
        process_state = minidump.process_minidump()
        assert 128 == process_state.module_count
        assert 59 == process_state.thread_count


def test_unreal_attachment_type_minidump():
    file = MockFile("minidump")
    assert unreal_attachment_type(file) == MINIDUMP_ATTACHMENT_TYPE


def test_unreal_attachment_type_unknown():
    file = MockFile("something unknown")
    assert unreal_attachment_type(file) is None


class MockFile():
    def __init__(self, type):
        self.type = type
