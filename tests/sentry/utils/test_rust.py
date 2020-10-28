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

STACKTRACE_SEMAPHORE_LINUX = """
stacktrace: stack backtrace:
   0: failure::backtrace::internal::InternalBacktrace::new::hc23de41c89e8c745 (0x7f2d0af481ba)
             at /home/parallels/.cargo/registry/src/github.com-1ecc6299db9ec823/failure-0.1.5/src/backtrace/internal.rs:44
   1: <T as core::convert::Into<U>>::into::hd4b72738b7e18e92 (0x7f2d0b070e3a)
             at /home/parallels/.cargo/registry/src/github.com-1ecc6299db9ec823/failure-0.1.5/src/backtrace/mod.rs:111
      semaphore::utils::set_panic_hook::{{closure}}::hacec55cb6b285e6a
             at src/utils.rs:45
   2: std::panicking::rust_panic_with_hook::h3c82d7c1012a629a (0x7f2d0b3d6fb6)
             at src/libstd/panicking.rs:477
   3: std::panicking::begin_panic::h3db9895361250d80 (0x7f2d0b06ba94)
             at /rustc/224f0bc90c010b88ca6ec600c9b02f6e3638d78e/src/libstd/panicking.rs:407
   4: semaphore::processing::semaphore_test_panic::{{closure}}::hb800a646d3f454a4 (0x7f2d0b06e999)
             at src/processing.rs:119
   5: std::panic::catch_unwind::hdc352a616e262d7e (0x7f2d0b03c59a)
             at /rustc/224f0bc90c010b88ca6ec600c9b02f6e3638d78e/src/libstd/panicking.rs:292
      semaphore_test_panic
             at src/utils.rs:53
   6: ffi_call_unix64 (0x7f2d0b839df0)
   7: ffi_call (0x7f2d0b839858)
             at ../src/x86/ffi64.c:525
   8: cdata_call (0x7f2d0ba57d64)
             at c/_cffi_backend.c:3025
   9: PyObject_Call (0x459eee)
  10: _PyEval_EvalFrameDefault (0x552c49)
  11: <unknown> (0x54fbe1)
  12: <unknown> (0x54fe6d)
  13: _PyEval_EvalFrameDefault (0x5546cf)
  14: <unknown> (0x54f0e8)
  15: <unknown> (0x550116)
  16: _PyEval_EvalFrameDefault (0x5546cf)
  17: <unknown> (0x54fbe1)
  18: PyEval_EvalCode (0x550b93)
  19: <unknown> (0x42ca41)
  20: PyRun_InteractiveLoopFlags (0x42ccb6)
  21: PyRun_AnyFileExFlags (0x42ce5c)
  22: Py_Main (0x442143)
  23: main (0x421ff4)
  24: __libc_start_main (0x7f2d0e8beb97)
  25: _start (0x4220aa)
  26: <unknown> (0x0)
"""


def get_event(stacktrace):
    return {
        "event_id": "fe628bfa48064c9b97ce7e75a19e6197",
        "level": "error",
        "platform": "python",
        "logentry": {"formatted": "invalid debug identifier\n\n%s" % stacktrace},
        "exception": {
            "values": [
                {
                    "type": "ParseDebugIdError",
                    "value": "invalid debug identifier\n\n%s" % stacktrace,
                    "stacktrace": {
                        "frames": [
                            {
                                "abs_path": "/symbolic/py/symbolic/utils.py",
                                "filename": "symbolic/utils.py",
                                "function": "rustcall",
                                "in_app": True,
                                "lineno": 93,
                                "module": "symbolic.utils",
                            }
                        ]
                    },
                }
            ]
        },
    }


def get_exc_info(rust_info):
    exc = ValueError("hello world")
    if rust_info is not None:
        exc.rust_info = rust_info
    return type(exc), exc, None


def test_merge_rust_info():
    event = get_event(STACKTRACE)
    exc_info = get_exc_info(STACKTRACE)

    merge_rust_info_frames(event, {"exc_info": exc_info})

    assert event["platform"] == "native"
    assert event["logentry"]["formatted"] == "invalid debug identifier"

    exception = event["exception"]["values"][0]
    assert exception["value"] == "invalid debug identifier"

    frames = exception["stacktrace"]["frames"]
    assert len(frames) == 8
    assert frames[0]["platform"] == "python"

    # Top frame
    assert frames[7]["instruction_addr"] == "0x11163e27c"
    assert frames[7]["function"] == "<failure::error::Error as core::convert::From<F>>::from"
    assert frames[7]["package"] == "failure"
    assert frames[7]["in_app"] is False
    assert frames[7]["filename"] == "mod.rs"
    assert frames[7]["lineno"] == 36

    # Inlined frame, same address
    assert frames[7]["instruction_addr"] == "0x11163e27c"
    assert frames[6]["function"] == "<T as core::convert::Into<U>>::into"
    assert frames[6]["package"] == "core"
    assert frames[6]["in_app"] is False
    assert frames[6]["filename"] == "convert.rs"
    assert frames[6]["lineno"] == 456


def test_merge_rust_info_linux():
    event = get_event(STACKTRACE_SEMAPHORE_LINUX)
    exc_info = get_exc_info(STACKTRACE_SEMAPHORE_LINUX)

    merge_rust_info_frames(event, {"exc_info": exc_info})

    assert event["platform"] == "native"
    assert event["logentry"]["formatted"] == "invalid debug identifier"

    exception = event["exception"]["values"][0]
    assert exception["value"] == "invalid debug identifier"

    frames = exception["stacktrace"]["frames"]
    assert len(frames) == 4
    assert frames[0]["platform"] == "python"

    # Top frame
    assert frames[-1]["instruction_addr"] == "0x7f2d0b06e999"
    assert frames[-1]["function"] == "semaphore::processing::semaphore_test_panic::{{closure}}"

    # Inlined frame, same address
    assert frames[-2]["instruction_addr"] == "0x7f2d0b03c59a"
    assert frames[-2]["function"] == "std::panic::catch_unwind"


def test_without_exc_info():
    event = get_event(STACKTRACE)
    merge_rust_info_frames(event, {})
    assert event["platform"] == "python"


def test_without_rust_info():
    event = get_event(STACKTRACE)
    exc_info = get_exc_info(None)

    merge_rust_info_frames(event, {"exc_info": exc_info})
    assert event["platform"] == "python"


def test_without_stacktrace():
    stacktrace = "stacktrace: stack backtrace:\n\n"
    event = get_event(stacktrace)
    exc_info = get_exc_info(stacktrace)

    merge_rust_info_frames(event, {"exc_info": exc_info})

    assert event["platform"] == "native"
    assert event["logentry"]["formatted"] == "invalid debug identifier"

    exception = event["exception"]["values"][0]
    assert exception["value"] == "invalid debug identifier"

    frames = exception["stacktrace"]["frames"]
    assert len(frames) == 1


def test_without_exception():
    event = get_event(STACKTRACE)
    exc_info = get_exc_info(STACKTRACE)

    del event["exception"]
    merge_rust_info_frames(event, {"exc_info": exc_info})
    assert event["platform"] == "python"


def test_starts_with():
    # Basic functions
    assert starts_with("__rust_maybe_catch_panic", "__rust")
    assert starts_with("futures::task_impl::std::set", "futures::")
    assert not starts_with("futures::task_impl::std::set", "tokio::")

    # Generics
    assert starts_with("_<futures..task_impl..Spawn<T>>::enter::_{{closure}}", "futures::")
    assert not starts_with("_<futures..task_impl..Spawn<T>>::enter::_{{closure}}", "tokio::")
    assert starts_with("<futures::task_impl::Spawn<T>>::enter::{{closure}}", "futures::")
    assert not starts_with("<futures::task_impl::Spawn<T>>::enter::{{closure}}", "tokio::")

    # Trait implementations
    assert starts_with("<failure::error::Error as core::convert::From<F>>::from", "failure::")
    assert starts_with("_<failure::error::Error as core::convert::From<F>>::from", "failure::")

    # Blanket implementations
    assert starts_with("<T as core::convert::Into<U>>::into", "core::")


def test_strip_symbol():
    assert strip_symbol("") == ""
    assert strip_symbol("_ffi_call_unix64") == "_ffi_call_unix64"
    assert (
        strip_symbol("backtrace::backtrace::trace::h1c213d29ba950696")
        == "backtrace::backtrace::trace"
    )
    assert (
        strip_symbol("<T as core::convert::Into<U>>::into::h58e05f056150874e")
        == "<T as core::convert::Into<U>>::into"
    )
    assert strip_symbol("symbolic_symcache_from_object") == "symbolic_symcache_from_object"
