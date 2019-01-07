from __future__ import absolute_import


from sentry.utils.rust import merge_rust_info_frames, starts_with, strip_symbol

STACKTRACE = """
stacktrace: stack backtrace:
   0:        0x111e51cf4 - backtrace::backtrace::trace::h38e3b1de9f341e04
                        at /.cargo/registry/src/github.com-1ecc6299db9ec823/backtrace-0.3.9/src/backtrace/mod.rs:42
   1:        0x111e4a3be - failure::backtrace::Backtrace::new::h2abf3908d09948f1
                        at /.cargo/registry/src/github.com-1ecc6299db9ec823/failure-0.1.3/src/backtrace/mod.rs:111
   2:        0x11163e27c - <failure::error::Error as core::convert::From<F>>::from::h5ae4b38f39150cb2
                        at /.cargo/registry/src/github.com-1ecc6299db9ec823/failure-0.1.3/src/error/mod.rs:36
                         - <T as core::convert::Into<U>>::into::h58e05f056150874e
                        at libcore/convert.rs:456
   3:        0x11163a9b7 - symbolic::debuginfo::symbolic_normalize_debug_id::{{closure}}::he767b4111eb41a33
                        at /symbolic/cabi/src/debuginfo.rs:160
   4:        0x111e7f5de - ___rust_maybe_catch_panic
                        at /rustc/da5f414c2c0bfe5198934493f04c676e2b23ff2e/src/libpanic_unwind/lib.rs:103
   5:        0x111618fcb - std::panic::catch_unwind::h66eea40447da0e66
                        at /symbolic/cabi/libstd/panic.rs:392
   6:        0x11160b9c1 - symbolic::utils::landingpad::h3cd528225184a301
                        at /symbolic/cabi/src/utils.rs:55
   7:        0x111632f43 - _symbolic_normalize_debug_id
                        at /symbolic/cabi/src/utils.rs:74
   8:     0x7fff69609f6b - _ffi_call_unix64
   9:     0x7fff6960a786 - _ffi_call
  10:        0x10fab19d6 - _cdata_call
  11:        0x10efc014f - _PyObject_Call
  12:        0x10f069f43 - _Py_Main
"""


def get_event(stacktrace):
    return {
        'event_id': 'fe628bfa48064c9b97ce7e75a19e6197',
        'level': 'error',
        'platform': 'python',
        'logentry': {
            'formatted': 'invalid debug identifier\n\n%s' % stacktrace,
        },
        'exception': {
            'values': [{
                'type': 'ParseDebugIdError',
                'value': 'invalid debug identifier\n\n%s' % stacktrace,
                'stacktrace': {
                    'frames': [
                        {
                            'abs_path': '/symbolic/py/symbolic/utils.py',
                            'filename': 'symbolic/utils.py',
                            'function': 'rustcall',
                            'in_app': True,
                            'lineno': 93,
                            'module': 'symbolic.utils',
                        }
                    ]
                },
            }]
        },
    }


def get_exc_info(rust_info):
    exc = ValueError('hello world')
    if rust_info is not None:
        exc.rust_info = rust_info
    return type(exc), exc, None


def test_merge_rust_info():
    event = get_event(STACKTRACE)
    exc_info = get_exc_info(STACKTRACE)

    merge_rust_info_frames(event, {'exc_info': exc_info})

    assert event['platform'] == 'native'
    assert event['logentry']['formatted'] == 'invalid debug identifier'

    exception = event['exception']['values'][0]
    assert exception['value'] == 'invalid debug identifier'

    frames = exception['stacktrace']['frames']
    assert len(frames) == 8
    assert frames[0]['platform'] == 'python'

    # Top frame
    assert frames[7]['instruction_addr'] == '0x11163e27c'
    assert frames[7]['function'] == '<failure::error::Error as core::convert::From<F>>::from'
    assert frames[7]['package'] == 'failure'
    assert frames[7]['in_app'] is False
    assert frames[7]['filename'] == 'mod.rs'
    assert frames[7]['lineno'] == 36

    # Inlined frame, same address
    assert frames[7]['instruction_addr'] == '0x11163e27c'
    assert frames[6]['function'] == '<T as core::convert::Into<U>>::into'
    assert frames[6]['package'] == 'core'
    assert frames[6]['in_app'] is False
    assert frames[6]['filename'] == 'convert.rs'
    assert frames[6]['lineno'] == 456


def test_without_exc_info():
    event = get_event(STACKTRACE)
    merge_rust_info_frames(event, {})
    assert event['platform'] == 'python'


def test_without_rust_info():
    event = get_event(STACKTRACE)
    exc_info = get_exc_info(None)

    merge_rust_info_frames(event, {'exc_info': exc_info})
    assert event['platform'] == 'python'


def test_without_stacktrace():
    stacktrace = 'stacktrace: stack backtrace:\n\n'
    event = get_event(stacktrace)
    exc_info = get_exc_info(stacktrace)

    merge_rust_info_frames(event, {'exc_info': exc_info})

    assert event['platform'] == 'native'
    assert event['logentry']['formatted'] == 'invalid debug identifier'

    exception = event['exception']['values'][0]
    assert exception['value'] == 'invalid debug identifier'

    frames = exception['stacktrace']['frames']
    assert len(frames) == 1


def test_without_exception():
    event = get_event(STACKTRACE)
    exc_info = get_exc_info(STACKTRACE)

    del event['exception']
    merge_rust_info_frames(event, {'exc_info': exc_info})
    assert event['platform'] == 'python'


def test_starts_with():
    # Basic functions
    assert starts_with('__rust_maybe_catch_panic', '__rust')
    assert starts_with('futures::task_impl::std::set', 'futures::')
    assert not starts_with('futures::task_impl::std::set', 'tokio::')

    # Generics
    assert starts_with('_<futures..task_impl..Spawn<T>>::enter::_{{closure}}', 'futures::')
    assert not starts_with('_<futures..task_impl..Spawn<T>>::enter::_{{closure}}', 'tokio::')
    assert starts_with('<futures::task_impl::Spawn<T>>::enter::{{closure}}', 'futures::')
    assert not starts_with('<futures::task_impl::Spawn<T>>::enter::{{closure}}',
                           'tokio::')

    # Trait implementations
    assert starts_with('<failure::error::Error as core::convert::From<F>>::from', 'failure::')
    assert starts_with('_<failure::error::Error as core::convert::From<F>>::from', 'failure::')

    # Blanket implementations
    assert starts_with('<T as core::convert::Into<U>>::into', 'core::')


def test_strip_symbol():
    assert strip_symbol('') == ''
    assert strip_symbol('_ffi_call_unix64') == '_ffi_call_unix64'
    assert strip_symbol(
        'backtrace::backtrace::trace::h1c213d29ba950696') == 'backtrace::backtrace::trace'
    assert strip_symbol(
        '<T as core::convert::Into<U>>::into::h58e05f056150874e') == '<T as core::convert::Into<U>>::into'
    assert strip_symbol('symbolic_symcache_from_object') == 'symbolic_symcache_from_object'
