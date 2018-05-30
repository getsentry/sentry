"""
sentry.interfaces.exception
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

__all__ = ('Exception', 'Mechanism', 'normalize_mechanism_meta', 'upgrade_legacy_mechanism')

import re
import six

from django.conf import settings

from sentry.interfaces.base import Interface, InterfaceValidationError
from sentry.interfaces.schemas import validate_and_default_interface
from sentry.interfaces.stacktrace import Stacktrace, slim_frame_data
from sentry.utils import json
from sentry.utils.safe import trim

_type_value_re = re.compile('^(\w+):(.*)$')

WELL_KNOWN_ERRNO = {
    'linux': {
        1: 'EPERM',  # Operation not permitted
        2: 'ENOENT',  # No such file or directory
        3: 'ESRCH',  # No such process
        4: 'EINTR',  # Interrupted system call
        5: 'EIO',  # I/O error
        6: 'ENXIO',  # No such device or address
        7: 'E2BIG',  # Argument list too long
        8: 'ENOEXEC',  # Exec format error
        9: 'EBADF',  # Bad file number
        10: 'ECHILD',  # No child processes
        11: 'EAGAIN',  # Try again
        12: 'ENOMEM',  # Out of memory
        13: 'EACCES',  # Permission denied
        14: 'EFAULT',  # Bad address
        15: 'ENOTBLK',  # Block device required
        16: 'EBUSY',  # Device or resource busy
        17: 'EEXIST',  # File exists
        18: 'EXDEV',  # Cross-device link
        19: 'ENODEV',  # No such device
        20: 'ENOTDIR',  # Not a directory
        21: 'EISDIR',  # Is a directory
        22: 'EINVAL',  # Invalid argument
        23: 'ENFILE',  # File table overflow
        24: 'EMFILE',  # Too many open files
        25: 'ENOTTY',  # Not a typewriter
        26: 'ETXTBSY',  # Text file busy
        27: 'EFBIG',  # File too large
        28: 'ENOSPC',  # No space left on device
        29: 'ESPIPE',  # Illegal seek
        30: 'EROFS',  # Read-only file system
        31: 'EMLINK',  # Too many links
        32: 'EPIPE',  # Broken pipe
        33: 'EDOM',  # Math argument out of domain of func
        34: 'ERANGE',  # Math result not representable

        35: 'EDEADLK',  # Resource deadlock would occur
        36: 'ENAMETOOLONG',  # File name too long
        37: 'ENOLCK',  # No record locks available

        38: 'ENOSYS',  # Invalid system call number

        39: 'ENOTEMPTY',  # Directory not empty
        40: 'ELOOP',  # Too many symbolic links encountered
        42: 'ENOMSG',  # No message of desired type
        43: 'EIDRM',  # Identifier removed
        44: 'ECHRNG',  # Channel number out of range
        45: 'EL2NSYNC',  # Level 2 not synchronized
        46: 'EL3HLT',  # Level 3 halted
        47: 'EL3RST',  # Level 3 reset
        48: 'ELNRNG',  # Link number out of range
        49: 'EUNATCH',  # Protocol driver not attached
        50: 'ENOCSI',  # No CSI structure available
        51: 'EL2HLT',  # Level 2 halted
        52: 'EBADE',  # Invalid exchange
        53: 'EBADR',  # Invalid request descriptor
        54: 'EXFULL',  # Exchange full
        55: 'ENOANO',  # No anode
        56: 'EBADRQC',  # Invalid request code
        57: 'EBADSLT',  # Invalid slot

        59: 'EBFONT',  # Bad font file format
        60: 'ENOSTR',  # Device not a stream
        61: 'ENODATA',  # No data available
        62: 'ETIME',  # Timer expired
        63: 'ENOSR',  # Out of streams resources
        64: 'ENONET',  # Machine is not on the network
        65: 'ENOPKG',  # Package not installed
        66: 'EREMOTE',  # Object is remote
        67: 'ENOLINK',  # Link has been severed
        68: 'EADV',  # Advertise error
        69: 'ESRMNT',  # Srmount error
        70: 'ECOMM',  # Communication error on send
        71: 'EPROTO',  # Protocol error
        72: 'EMULTIHOP',  # Multihop attempted
        73: 'EDOTDOT',  # RFS specific error
        74: 'EBADMSG',  # Not a data message
        75: 'EOVERFLOW',  # Value too large for defined data type
        76: 'ENOTUNIQ',  # Name not unique on network
        77: 'EBADFD',  # File descriptor in bad state
        78: 'EREMCHG',  # Remote address changed
        79: 'ELIBACC',  # Can not access a needed shared library
        80: 'ELIBBAD',  # Accessing a corrupted shared library
        81: 'ELIBSCN',  # .lib section in a.out corrupted
        82: 'ELIBMAX',  # Attempting to link in too many shared libraries
        83: 'ELIBEXEC',  # Cannot exec a shared library directly
        84: 'EILSEQ',  # Illegal byte sequence
        85: 'ERESTART',  # Interrupted system call should be restarted
        86: 'ESTRPIPE',  # Streams pipe error
        87: 'EUSERS',  # Too many users
        88: 'ENOTSOCK',  # Socket operation on non-socket
        89: 'EDESTADDRREQ',  # Destination address required
        90: 'EMSGSIZE',  # Message too long
        91: 'EPROTOTYPE',  # Protocol wrong type for socket
        92: 'ENOPROTOOPT',  # Protocol not available
        93: 'EPROTONOSUPPORT',  # Protocol not supported
        94: 'ESOCKTNOSUPPORT',  # Socket type not supported
        95: 'EOPNOTSUPP',  # Operation not supported on transport endpoint
        96: 'EPFNOSUPPORT',  # Protocol family not supported
        97: 'EAFNOSUPPORT',  # Address family not supported by protocol
        98: 'EADDRINUSE',  # Address already in use
        99: 'EADDRNOTAVAIL',  # Cannot assign requested address
        100: 'ENETDOWN',  # Network is down
        101: 'ENETUNREACH',  # Network is unreachable
        102: 'ENETRESET',  # Network dropped connection because of reset
        103: 'ECONNABORTED',  # Software caused connection abort
        104: 'ECONNRESET',  # Connection reset by peer
        105: 'ENOBUFS',  # No buffer space available
        106: 'EISCONN',  # Transport endpoint is already connected
        107: 'ENOTCONN',  # Transport endpoint is not connected
        108: 'ESHUTDOWN',  # Cannot send after transport endpoint shutdown
        109: 'ETOOMANYREFS',  # Too many references: cannot splice
        110: 'ETIMEDOUT',  # Connection timed out
        111: 'ECONNREFUSED',  # Connection refused
        112: 'EHOSTDOWN',  # Host is down
        113: 'EHOSTUNREACH',  # No route to host
        114: 'EALREADY',  # Operation already in progress
        115: 'EINPROGRESS',  # Operation now in progress
        116: 'ESTALE',  # Stale file handle
        117: 'EUCLEAN',  # Structure needs cleaning
        118: 'ENOTNAM',  # Not a XENIX named type file
        119: 'ENAVAIL',  # No XENIX semaphores available
        120: 'EISNAM',  # Is a named type file
        121: 'EREMOTEIO',  # Remote I/O error
        122: 'EDQUOT',  # Quota exceeded

        123: 'ENOMEDIUM',  # No medium found
        124: 'EMEDIUMTYPE',  # Wrong medium type
        125: 'ECANCELED',  # Operation Canceled
        126: 'ENOKEY',  # Required key not available
        127: 'EKEYEXPIRED',  # Key has expired
        128: 'EKEYREVOKED',  # Key has been revoked
        129: 'EKEYREJECTED',  # Key was rejected by service

        130: 'EOWNERDEAD',  # Owner died
        131: 'ENOTRECOVERABLE',  # State not recoverable

        132: 'ERFKILL',  # Operation not possible due to RF-kill

        133: 'EHWPOISON',  # Memory page has hardware error
    },
    'darwin': {
        1: 'EPERM',  # Operation not permitted
        2: 'ENOENT',  # No such file or directory
        3: 'ESRCH',  # No such process
        4: 'EINTR',  # Interrupted system call
        5: 'EIO',  # Input/output error
        6: 'ENXIO',  # Device not configured
        7: 'E2BIG',  # Argument list too long
        8: 'ENOEXEC',  # Exec format error
        9: 'EBADF',  # Bad file descriptor
        10: 'ECHILD',  # No child processes
        11: 'EDEADLK',  # Resource deadlock avoided
        12: 'ENOMEM',  # Cannot allocate memory
        13: 'EACCES',  # Permission denied
        14: 'EFAULT',  # Bad address
        15: 'ENOTBLK',  # Block device required
        16: 'EBUSY',  # Device / Resource busy
        17: 'EEXIST',  # File exists
        18: 'EXDEV',  # Cross-device link
        19: 'ENODEV',  # Operation not supported by device
        20: 'ENOTDIR',  # Not a directory
        21: 'EISDIR',  # Is a directory
        22: 'EINVAL',  # Invalid argument
        23: 'ENFILE',  # Too many open files in system
        24: 'EMFILE',  # Too many open files
        25: 'ENOTTY',  # Inappropriate ioctl for device
        26: 'ETXTBSY',  # Text file busy
        27: 'EFBIG',  # File too large
        28: 'ENOSPC',  # No space left on device
        29: 'ESPIPE',  # Illegal seek
        30: 'EROFS',  # Read-only file system
        31: 'EMLINK',  # Too many links
        32: 'EPIPE',  # Broken pipe

        # math software
        33: 'EDOM',  # Numerical argument out of domain
        34: 'ERANGE',  # Result too large

        # non - blocking and interrupt i / o
        35: 'EAGAIN',  # Resource temporarily unavailable
        36: 'EINPROGRESS',  # Operation now in progress
        37: 'EALREADY',  # Operation already in progress

        # ipc / network software - - argument errors
        38: 'ENOTSOCK',  # Socket operation on non-socket
        39: 'EDESTADDRREQ',  # Destination address required
        40: 'EMSGSIZE',  # Message too long
        41: 'EPROTOTYPE',  # Protocol wrong type for socket
        42: 'ENOPROTOOPT',  # Protocol not available
        43: 'EPROTONOSUPPORT',  # Protocol not supported
        44: 'ESOCKTNOSUPPORT',  # Socket type not supported
        45: 'ENOTSUP',  # Operation not supported

        46: 'EPFNOSUPPORT',  # Protocol family not supported
        47: 'EAFNOSUPPORT',  # Address family not supported by protocol family
        48: 'EADDRINUSE',  # Address already in use
        49: 'EADDRNOTAVAIL',  # Can't assign requested address

        # ipc / network software - - operational errors
        50: 'ENETDOWN',  # Network is down
        51: 'ENETUNREACH',  # Network is unreachable
        52: 'ENETRESET',  # Network dropped connection on reset
        53: 'ECONNABORTED',  # Software caused connection abort
        54: 'ECONNRESET',  # Connection reset by peer
        55: 'ENOBUFS',  # No buffer space available
        56: 'EISCONN',  # Socket is already connected
        57: 'ENOTCONN',  # Socket is not connected
        58: 'ESHUTDOWN',  # Can't send after socket shutdown
        59: 'ETOOMANYREFS',  # Too many references: can't splice
        60: 'ETIMEDOUT',  # Operation timed out
        61: 'ECONNREFUSED',  # Connection refused

        62: 'ELOOP',  # Too many levels of symbolic links
        63: 'ENAMETOOLONG',  # File name too long

        # should be rearranged
        64: 'EHOSTDOWN',  # Host is down
        65: 'EHOSTUNREACH',  # No route to host
        66: 'ENOTEMPTY',  # Directory not empty

        # quotas & mush
        67: 'EPROCLIM',  # Too many processes
        68: 'EUSERS',  # Too many users
        69: 'EDQUOT',  # Disc quota exceeded

        # Network File System
        70: 'ESTALE',  # Stale NFS file handle
        71: 'EREMOTE',  # Too many levels of remote in path
        72: 'EBADRPC',  # RPC struct is bad
        73: 'ERPCMISMATCH',  # RPC version wrong
        74: 'EPROGUNAVAIL',  # RPC prog. not avail
        75: 'EPROGMISMATCH',  # Program version wrong
        76: 'EPROCUNAVAIL',  # Bad procedure for program

        77: 'ENOLCK',  # No locks available
        78: 'ENOSYS',  # Function not implemented

        79: 'EFTYPE',  # Inappropriate file type or format
        80: 'EAUTH',  # Authentication error
        81: 'ENEEDAUTH',  # Need authenticator

        # Intelligent device errors
        82: 'EPWROFF',  # Device power is off
        83: 'EDEVERR',  # Device error, e.g. paper out

        84: 'EOVERFLOW',  # Value too large to be stored in data type

        # Program loading errors
        85: 'EBADEXEC',  # Bad executable
        86: 'EBADARCH',  # Bad CPU type in executable
        87: 'ESHLIBVERS',  # Shared library version mismatch
        88: 'EBADMACHO',  # Malformed Macho file

        89: 'ECANCELED',  # Operation canceled

        90: 'EIDRM',  # Identifier removed
        91: 'ENOMSG',  # No message of desired type
        92: 'EILSEQ',  # Illegal byte sequence
        93: 'ENOATTR',  # Attribute not found

        94: 'EBADMSG',  # Bad message
        95: 'EMULTIHOP',  # Reserved
        96: 'ENODATA',  # No message available on STREAM
        97: 'ENOLINK',  # Reserved
        98: 'ENOSR',  # No STREAM resources
        99: 'ENOSTR',  # Not a STREAM
        100: 'EPROTO',  # Protocol error
        101: 'ETIME',  # STREAM ioctl timeout

        102: 'EOPNOTSUPP',  # Operation not supported on socket
        103: 'ENOPOLICY',  # No such policy registered
        104: 'ENOTRECOVERABLE',  # State not recoverable
        105: 'EOWNERDEAD',  # Previous owner died
        106: 'EQFULL',  # Interface output queue is full
    },
    'windows': {
        1: 'EPERM',
        2: 'ENOENT',
        3: 'ESRCH',
        4: 'EINTR',
        5: 'EIO',
        6: 'ENXIO',
        7: 'E2BIG',
        8: 'ENOEXEC',
        9: 'EBADF',
        10: 'ECHILD',
        11: 'EAGAIN',
        12: 'ENOMEM',
        13: 'EACCES',
        14: 'EFAULT',
        16: 'EBUSY',
        17: 'EEXIST',
        18: 'EXDEV',
        19: 'ENODEV',
        20: 'ENOTDIR',
        21: 'EISDIR',
        23: 'ENFILE',
        24: 'EMFILE',
        25: 'ENOTTY',
        27: 'EFBIG',
        28: 'ENOSPC',
        29: 'ESPIPE',
        30: 'EROFS',
        31: 'EMLINK',
        32: 'EPIPE',
        33: 'EDOM',
        36: 'EDEADLK',
        38: 'ENAMETOOLONG',
        39: 'ENOLCK',
        40: 'ENOSYS',
        41: 'ENOTEMPTY',

        # Error codes used in the Secure CRT functions
        22: 'EINVAL',
        34: 'ERANGE',
        42: 'EILSEQ',
        80: 'STRUNCATE',

        # POSIX Supplement
        100: 'EADDRINUSE',
        101: 'EADDRNOTAVAIL',
        102: 'EAFNOSUPPORT',
        103: 'EALREADY',
        104: 'EBADMSG',
        105: 'ECANCELED',
        106: 'ECONNABORTED',
        107: 'ECONNREFUSED',
        108: 'ECONNRESET',
        109: 'EDESTADDRREQ',
        110: 'EHOSTUNREACH',
        111: 'EIDRM',
        112: 'EINPROGRESS',
        113: 'EISCONN',
        114: 'ELOOP',
        115: 'EMSGSIZE',
        116: 'ENETDOWN',
        117: 'ENETRESET',
        118: 'ENETUNREACH',
        119: 'ENOBUFS',
        120: 'ENODATA',
        121: 'ENOLINK',
        122: 'ENOMSG',
        123: 'ENOPROTOOPT',
        124: 'ENOSR',
        125: 'ENOSTR',
        126: 'ENOTCONN',
        127: 'ENOTRECOVERABLE',
        128: 'ENOTSOCK',
        129: 'ENOTSUP',
        130: 'EOPNOTSUPP',
        131: 'EOTHER',
        132: 'EOVERFLOW',
        133: 'EOWNERDEAD',
        134: 'EPROTO',
        135: 'EPROTONOSUPPORT',
        136: 'EPROTOTYPE',
        137: 'ETIME',
        138: 'ETIMEDOUT',
        139: 'ETXTBSY',
        140: 'EWOULDBLOCK',
    },
}

WELL_KNOWN_SIGNALS = {
    # Linux signals have been taken from <uapi/asm-generic/signal.h>
    'linux': {
        1: 'SIGHUP',  # Hangup.
        2: 'SIGINT',  # Terminal interrupt signal.
        3: 'SIGQUIT',  # Terminal quit signal.
        4: 'SIGILL',  # Illegal instruction.
        5: 'SIGTRAP',
        6: 'SIGABRT',  # Process abort signal.
        7: 'SIGBUS',
        8: 'SIGFPE',  # Erroneous arithmetic operation.
        9: 'SIGKILL',  # Kill (cannot be caught or ignored).
        10: 'SIGUSR1',  # User-defined signal 1.
        11: 'SIGSEGV',  # Invalid memory reference.
        12: 'SIGUSR2',  # User-defined signal 2.
        13: 'SIGPIPE',  # Write on a pipe with no one to read it.
        14: 'SIGALRM',  # Alarm clock.
        15: 'SIGTERM',  # Termination signal.
        16: 'SIGSTKFLT',
        17: 'SIGCHLD',  # Child process terminated or stopped.
        18: 'SIGCONT',  # Continue executing, if stopped.
        19: 'SIGSTOP',  # Stop executing (cannot be caught or ignored).
        20: 'SIGTSTP',  # Terminal stop signal.
        21: 'SIGTTIN',  # Background process attempting read.
        22: 'SIGTTOU',  # Background process attempting write.
        23: 'SIGURG',  # High bandwidth data is available at a socket.
        24: 'SIGXCPU',  # CPU time limit exceeded.
        25: 'SIGXFSZ',  # File size limit exceeded.
        26: 'SIGVTALRM',  # Virtual timer expired.
        27: 'SIGPROF',  # Profiling timer expired.
        28: 'SIGWINCH',
        29: 'SIGIO',
        30: 'SIGPWR',
        31: 'SIGSYS',
    },
    'darwin': {
        1: 'SIGHUP',  # hangup
        2: 'SIGINT',  # interrupt
        3: 'SIGQUIT',  # quit
        4: 'SIGILL',  # illegal instruction (not reset when caught)
        5: 'SIGTRAP',  # trace trap (not reset when caught)
        6: 'SIGABRT',  # abort()
        # if (defined(_POSIX_C_SOURCE) && !defined(_DARWIN_C_SOURCE))
        7: 'SIGPOLL',  # pollable event ([XSR] generated, not supported)
        # if (!_POSIX_C_SOURCE || _DARWIN_C_SOURCE)
        # 7: 'SIGEMT', # EMT instruction
        8: 'SIGFPE',  # floating point exception
        9: 'SIGKILL',  # kill (cannot be caught or ignored)
        10: 'SIGBUS',  # bus error
        11: 'SIGSEGV',  # segmentation violation
        12: 'SIGSYS',  # bad argument to system call
        13: 'SIGPIPE',  # write on a pipe with no one to read it
        14: 'SIGALRM',  # alarm clock
        15: 'SIGTERM',  # software termination signal from kill
        16: 'SIGURG',  # urgent condition on IO channel
        17: 'SIGSTOP',  # sendable stop signal not from tty
        18: 'SIGTSTP',  # stop signal from tty
        19: 'SIGCONT',  # continue a stopped process
        20: 'SIGCHLD',  # to parent on child stop or exit
        21: 'SIGTTIN',  # to readers pgrp upon background tty read
        22: 'SIGTTOU',  # like TTIN for output if (tp->t_local&LTOSTOP)
        23: 'SIGIO',  # input/output possible signal
        24: 'SIGXCPU',  # exceeded CPU time limit
        25: 'SIGXFSZ',  # exceeded file size limit
        26: 'SIGVTALRM',  # virtual time alarm
        27: 'SIGPROF',  # profiling time alarm
        28: 'SIGWINCH',  # window size changes
        29: 'SIGINFO',  # information request
        30: 'SIGUSR1',  # user defined signal 1
        31: 'SIGUSR2',  # user defined signal 2
    },
}

# Codes for Darwin `si_code`
WELL_KNOWN_SIGNAL_CODES = {
    # Codes for SIGILL
    4: {
        0: 'ILL_NOOP',  # if only I knew...
        1: 'ILL_ILLOPC',  # [XSI] illegal opcode
        2: 'ILL_ILLTRP',  # [XSI] illegal trap
        3: 'ILL_PRVOPC',  # [XSI] privileged opcode
        4: 'ILL_ILLOPN',  # [XSI] illegal operand -NOTIMP
        5: 'ILL_ILLADR',  # [XSI] illegal addressing mode -NOTIMP
        6: 'ILL_PRVREG',  # [XSI] privileged register -NOTIMP
        7: 'ILL_COPROC',  # [XSI] coprocessor error -NOTIMP
        8: 'ILL_BADSTK',  # [XSI] internal stack error -NOTIMP
    },

    # Codes for SIGFPE
    8: {
        0: 'FPE_NOOP',  # if only I knew...
        1: 'FPE_FLTDIV',  # [XSI] floating point divide by zero
        2: 'FPE_FLTOVF',  # [XSI] floating point overflow
        3: 'FPE_FLTUND',  # [XSI] floating point underflow
        4: 'FPE_FLTRES',  # [XSI] floating point inexact result
        5: 'FPE_FLTINV',  # [XSI] invalid floating point operation
        6: 'FPE_FLTSUB',  # [XSI] subscript out of range -NOTIMP
        7: 'FPE_INTDIV',  # [XSI] integer divide by zero
        8: 'FPE_INTOVF',  # [XSI] integer overflow
    },

    # Codes for SIGSEGV
    11: {
        0: 'SEGV_NOOP',  # if only I knew...
        1: 'SEGV_MAPERR',  # [XSI] address not mapped to object
        2: 'SEGV_ACCERR',  # [XSI] invalid permission for mapped object
    },

    # Codes for SIGBUS
    10: {
        0: 'BUS_NOOP',  # if only I knew...
        1: 'BUS_ADRALN',  # [XSI] Invalid address alignment
        2: 'BUS_ADRERR',  # [XSI] Nonexistent physical address -NOTIMP
        3: 'BUS_OBJERR',  # [XSI] Object-specific HW error - NOTIMP
    },

    # Codes for SIGTRAP
    5: {
        1: 'TRAP_BRKPT',  # [XSI] Process breakpoint -NOTIMP
        2: 'TRAP_TRACE',  # [XSI] Process trace trap -NOTIMP
    },

    # Codes for SIGCHLD
    20: {
        0: 'CLD_NOOP',  # if only I knew...
        1: 'CLD_EXITED',  # [XSI] child has exited
        2: 'CLD_KILLED',  # [XSI] terminated abnormally, no core file
        3: 'CLD_DUMPED',  # [XSI] terminated abnormally, core file
        4: 'CLD_TRAPPED',  # [XSI] traced child has trapped
        5: 'CLD_STOPPED',  # [XSI] child has stopped
        6: 'CLD_CONTINUED',  # [XSI] stopped child has continued
    },

    # Codes for SIGPOLL
    7: {
        1: 'POLL_IN',  # [XSR] Data input available
        2: 'POLL_OUT',  # [XSR] Output buffers available
        3: 'POLL_MSG',  # [XSR] Input message available
        4: 'POLL_ERR',  # [XSR] I/O error
        5: 'POLL_PRI',  # [XSR] High priority input available
        6: 'POLL_HUP',  # [XSR] Device disconnected
    },
}

# Mach exception codes used in Darwin.
WELL_KNOWN_MACH_EXCEPTIONS = {
    1: 'EXC_BAD_ACCESS',  # Could not access memory
    2: 'EXC_BAD_INSTRUCTION',  # Instruction failed
    3: 'EXC_ARITHMETIC',  # Arithmetic exception
    4: 'EXC_EMULATION',  # Emulation instruction
    5: 'EXC_SOFTWARE',  # Software generated exception
    6: 'EXC_BREAKPOINT',  # Trace, breakpoint, etc.
    7: 'EXC_SYSCALL',  # System calls.
    8: 'EXC_MACH_SYSCALL',  # Mach system calls.
    9: 'EXC_RPC_ALERT',  # RPC alert
    10: 'EXC_CRASH',  # Abnormal process exit
    11: 'EXC_RESOURCE',  # Hit resource consumption limit
    12: 'EXC_GUARD',  # Violated guarded resource protections
    13: 'EXC_CORPSE_NOTIFY',  # Abnormal process exited to corpse state
}


def normalize_mechanism_errno(errno, sdk):
    if not sdk:
        return

    if 'name' not in errno:
        errnos = WELL_KNOWN_ERRNO.get(sdk, {})
        name = errnos.get(errno['number'])
        if name:
            errno['name'] = name


def normalize_mechanism_signal(signal, sdk):
    if not sdk:
        return

    if 'name' not in signal:
        signals = WELL_KNOWN_SIGNALS.get(sdk, {})
        name = signals.get(signal['number'])
        if name:
            signal['name'] = name

    if sdk != 'darwin':
        return

    if 'code' in signal and 'code_name' not in signal:
        codes = WELL_KNOWN_SIGNAL_CODES.get(signal['number'], {})
        code_name = codes.get(signal['code'])
        if code_name:
            signal['code_name'] = code_name


def normalize_mechanism_mach_exception(mach):
    if 'name' not in mach:
        name = WELL_KNOWN_MACH_EXCEPTIONS.get(mach['exception'])
        if name:
            mach['name'] = name


def normalize_mechanism_meta(mechanism, sdk_info=None):
    if mechanism is None or 'meta' not in mechanism:
        return

    meta = mechanism['meta']

    sdk_name = sdk_info['sdk_name'].lower() if sdk_info else ''
    if sdk_name in ('ios', 'watchos', 'tvos', 'macos'):
        sdk = 'darwin'
    elif sdk_name in ('linux', 'android'):
        sdk = 'linux'
    elif sdk_name in ('windows',):
        sdk = 'windows'
    else:
        sdk = None

    if 'errno' in meta:
        normalize_mechanism_errno(meta['errno'], sdk)

    if 'signal' in meta:
        normalize_mechanism_signal(meta['signal'], sdk)

    if 'mach_exception' in meta:
        normalize_mechanism_mach_exception(meta['mach_exception'])


def upgrade_legacy_mechanism(data):
    """
    Conversion from mechanism objects sent by old sentry-cocoa SDKs. It assumes
    "type": "generic" and moves "posix_signal", "mach_exception" into "meta".
    All other keys are moved into "data".

    Example old payload:
    >>> {
    >>>     "posix_signal": {
    >>>         "name": "SIGSEGV",
    >>>         "code_name": "SEGV_NOOP",
    >>>         "signal": 11,
    >>>         "code": 0
    >>>     },
    >>>     "relevant_address": "0x1",
    >>>     "mach_exception": {
    >>>         "exception": 1,
    >>>         "exception_name": "EXC_BAD_ACCESS",
    >>>         "subcode": 8,
    >>>         "code": 1
    >>>     }
    >>> }

    Example normalization:
    >>> {
    >>>     "type": "generic",
    >>>     "data": {
    >>>         "relevant_address": "0x1"
    >>>     },
    >>>     "meta": {
    >>>         "mach_exception": {
    >>>             "exception": 1,
    >>>             "subcode": 8,
    >>>             "code": 1,
    >>>             "name": "EXC_BAD_ACCESS"
    >>>         },
    >>>         "signal": {
    >>>             "number": 11,
    >>>             "code": 0,
    >>>             "name": "SIGSEGV",
    >>>             "code_name": "SEGV_NOOP"
    >>>         }
    >>>     }
    >>> }
    """

    # Early exit for current protocol. We assume that when someone sends a
    # "type", we do not need to preprocess and can immediately validate
    if data is None or data.get('type') is not None:
        return data

    result = {'type': 'generic'}

    # "posix_signal" and "mach_exception" were optional root-level objects,
    # which have now moved to special keys inside "meta". We only create "meta"
    # if there is actual data to add.

    posix_signal = data.pop('posix_signal', None)
    if posix_signal and posix_signal.get('signal'):
        result.setdefault('meta', {})['signal'] = prune_empty_keys({
            'number': posix_signal.get('signal'),
            'code': posix_signal.get('code'),
            'name': posix_signal.get('name'),
            'code_name': posix_signal.get('code_name'),
        })

    mach_exception = data.pop('mach_exception', None)
    if mach_exception:
        result.setdefault('meta', {})['mach_exception'] = prune_empty_keys({
            'exception': mach_exception.get('exception'),
            'code': mach_exception.get('code'),
            'subcode': mach_exception.get('subcode'),
            'name': mach_exception.get('exception_name'),
        })

    # All remaining data has to be moved to the "data" key. We assume that even
    # if someone accidentally sent a corret top-level key (such as "handled"),
    # it will not pass our interface validation and should be moved to "data"
    # instead.
    result.setdefault('data', {}).update(data)
    return result


def prune_empty_keys(obj):
    if obj is None:
        return None

    return dict((k, v) for k, v in six.iteritems(obj) if (v == 0 or v is False or v))


class Mechanism(Interface):
    """
    an optional field residing in the exception interface. It carries additional
    information about the way the exception was created on the target system.
    This includes general exception values obtained from operating system or
    runtime APIs, as well as mechanism-specific values.

    >>> {
    >>>     "type": "mach",
    >>>     "description": "EXC_BAD_ACCESS",
    >>>     "data": {
    >>>         "relevant_address": "0x1"
    >>>     },
    >>>     "handled": false,
    >>>     "help_link": "https://developer.apple.com/library/content/qa/qa1367/_index.html",
    >>>     "meta": {
    >>>         "mach_exception": {
    >>>              "exception": 1,
    >>>              "subcode": 8,
    >>>              "code": 1
    >>>         },
    >>>         "signal": {
    >>>             "number": 11
    >>>         }
    >>>     }
    >>> }
    """

    path = 'mechanism'

    @classmethod
    def to_python(cls, data):
        data = upgrade_legacy_mechanism(data)
        is_valid, errors = validate_and_default_interface(data, cls.path)
        if not is_valid:
            raise InterfaceValidationError("Invalid mechanism")

        if not data.get('type'):
            raise InterfaceValidationError("No 'type' present")

        meta = data.get('meta', {})
        mach_exception = meta.get('mach_exception')
        if mach_exception is not None:
            mach_exception = prune_empty_keys({
                'exception': mach_exception['exception'],
                'code': mach_exception['code'],
                'subcode': mach_exception['subcode'],
                'name': mach_exception.get('name'),
            })

        signal = meta.get('signal')
        if signal is not None:
            signal = prune_empty_keys({
                'number': signal['number'],
                'code': signal.get('code'),
                'name': signal.get('name'),
                'code_name': signal.get('code_name'),
            })

        errno = meta.get('errno')
        if errno is not None:
            errno = prune_empty_keys({
                'number': errno['number'],
                'name': errno.get('name'),
            })

        kwargs = {
            'type': trim(data['type'], 128),
            'description': trim(data.get('description'), 1024),
            'help_link': trim(data.get('help_link'), 1024),
            'handled': data.get('handled'),
            'data': trim(data.get('data'), 4096),
            'meta': {
                'errno': errno,
                'mach_exception': mach_exception,
                'signal': signal,
            },
        }

        return cls(**kwargs)

    def to_json(self):
        return prune_empty_keys({
            'type': self.type,
            'description': self.description,
            'help_link': self.help_link,
            'handled': self.handled,
            'data': self.data,
            'meta': prune_empty_keys(self.meta),
        })

    def get_path(self):
        return self.path

    def iter_tags(self):
        yield (self.path, self.type)

        if self.handled is not None:
            yield ('handled', self.handled and 'yes' or 'no')


class SingleException(Interface):
    """
    A standard exception with a ``type`` and value argument, and an optional
    ``module`` argument describing the exception class type and
    module namespace. Either ``type`` or ``value`` must be present.

    You can also optionally bind a stacktrace interface to an exception. The
    spec is identical to ``sentry.interfaces.Stacktrace``.

    >>> {
    >>>     "type": "ValueError",
    >>>     "value": "My exception value",
    >>>     "module": "__builtins__",
    >>>     "mechanism": {},
    >>>     "stacktrace": {
    >>>         # see sentry.interfaces.Stacktrace
    >>>     }
    >>> }
    """
    score = 2000
    path = 'sentry.interfaces.Exception'

    @classmethod
    def to_python(cls, data, slim_frames=True):
        is_valid, errors = validate_and_default_interface(data, cls.path)
        if not is_valid:
            raise InterfaceValidationError("Invalid exception")

        if not (data.get('type') or data.get('value')):
            raise InterfaceValidationError("No 'type' or 'value' present")

        if data.get('stacktrace') and data['stacktrace'].get('frames'):
            stacktrace = Stacktrace.to_python(
                data['stacktrace'],
                slim_frames=slim_frames,
            )
        else:
            stacktrace = None

        if data.get('raw_stacktrace') and data['raw_stacktrace'].get('frames'):
            raw_stacktrace = Stacktrace.to_python(
                data['raw_stacktrace'], slim_frames=slim_frames, raw=True
            )
        else:
            raw_stacktrace = None

        type = data.get('type')
        value = data.get('value')
        if isinstance(value, six.string_types):
            if type is None:
                m = _type_value_re.match(value)
                if m:
                    type = m.group(1)
                    value = m.group(2).strip()
        elif value is not None:
            value = json.dumps(value)

        value = trim(value, 4096)

        if data.get('mechanism'):
            mechanism = Mechanism.to_python(data['mechanism'])
        else:
            mechanism = None

        kwargs = {
            'type': trim(type, 128),
            'value': value,
            'module': trim(data.get('module'), 128),
            'mechanism': mechanism,
            'stacktrace': stacktrace,
            'thread_id': trim(data.get('thread_id'), 40),
            'raw_stacktrace': raw_stacktrace,
        }

        return cls(**kwargs)

    def to_json(self):
        mechanism = isinstance(self.mechanism, Mechanism) and \
            self.mechanism.to_json() or self.mechanism or None

        if self.stacktrace:
            stacktrace = self.stacktrace.to_json()
        else:
            stacktrace = None

        if self.raw_stacktrace:
            raw_stacktrace = self.raw_stacktrace.to_json()
        else:
            raw_stacktrace = None

        return {
            'type': self.type,
            'value': self.value,
            'mechanism': mechanism,
            'module': self.module,
            'stacktrace': stacktrace,
            'thread_id': self.thread_id,
            'raw_stacktrace': raw_stacktrace,
        }

    def get_api_context(self, is_public=False):
        mechanism = isinstance(self.mechanism, Mechanism) and \
            self.mechanism.to_json() or self.mechanism or None

        if self.stacktrace:
            stacktrace = self.stacktrace.get_api_context(is_public=is_public)
        else:
            stacktrace = None

        if self.raw_stacktrace:
            raw_stacktrace = self.raw_stacktrace.get_api_context(is_public=is_public)
        else:
            raw_stacktrace = None

        return {
            'type': self.type,
            'value': six.text_type(self.value) if self.value else None,
            'mechanism': mechanism,
            'threadId': self.thread_id,
            'module': self.module,
            'stacktrace': stacktrace,
            'rawStacktrace': raw_stacktrace,
        }

    def get_alias(self):
        return 'exception'

    def get_path(self):
        return self.path

    def get_hash(self, platform=None):
        output = None
        if self.stacktrace:
            output = self.stacktrace.get_hash(platform=platform)
            if output and self.type:
                output.append(self.type)
        if not output:
            output = [s for s in [self.type, self.value] if s]
        return output


class Exception(Interface):
    """
    An exception consists of a list of values. In most cases, this list
    contains a single exception, with an optional stacktrace interface.

    Each exception has a mandatory ``value`` argument and optional ``type`` and
    ``module`` arguments describing the exception class type and module
    namespace.

    You can also optionally bind a stacktrace interface to an exception. The
    spec is identical to ``sentry.interfaces.Stacktrace``.

    >>> {
    >>>     "values": [{
    >>>         "type": "ValueError",
    >>>         "value": "My exception value",
    >>>         "module": "__builtins__",
    >>>         "mechanism": {
    >>>             # see sentry.interfaces.Mechanism
    >>>         },
    >>>         "stacktrace": {
    >>>             # see sentry.interfaces.Stacktrace
    >>>         }
    >>>     }]
    >>> }

    Values should be sent oldest to newest, this includes both the stacktrace
    and the exception itself.

    .. note:: This interface can be passed as the 'exception' key in addition
              to the full interface path.
    """

    score = 2000

    def __getitem__(self, key):
        return self.values[key]

    def __iter__(self):
        return iter(self.values)

    def __len__(self):
        return len(self.values)

    @classmethod
    def to_python(cls, data):
        if 'values' not in data:
            data = {'values': [data]}

        if not data['values']:
            raise InterfaceValidationError("No 'values' present")

        if not isinstance(data['values'], list):
            raise InterfaceValidationError("Invalid value for 'values'")

        kwargs = {
            'values': [SingleException.to_python(
                v,
                slim_frames=False,
            ) for v in data['values']],
        }

        if data.get('exc_omitted'):
            if len(data['exc_omitted']) != 2:
                raise InterfaceValidationError("Invalid value for 'exc_omitted'")
            kwargs['exc_omitted'] = data['exc_omitted']
        else:
            kwargs['exc_omitted'] = None

        instance = cls(**kwargs)
        # we want to wait to slim things til we've reconciled in_app
        slim_exception_data(instance)
        return instance

    def to_json(self):
        return {
            'values': [v.to_json() for v in self.values],
            'exc_omitted': self.exc_omitted,
        }

    def get_alias(self):
        return 'exception'

    def get_path(self):
        return 'sentry.interfaces.Exception'

    def compute_hashes(self, platform):
        system_hash = self.get_hash(platform, system_frames=True)
        if not system_hash:
            return []

        app_hash = self.get_hash(platform, system_frames=False)
        if system_hash == app_hash or not app_hash:
            return [system_hash]

        return [system_hash, app_hash]

    def get_hash(self, platform=None, system_frames=True):
        # optimize around the fact that some exceptions might have stacktraces
        # while others may not and we ALWAYS want stacktraces over values
        output = []
        for value in self.values:
            if not value.stacktrace:
                continue
            stack_hash = value.stacktrace.get_hash(
                platform=platform,
                system_frames=system_frames,
            )
            if stack_hash:
                output.extend(stack_hash)
                output.append(value.type)

        if not output:
            for value in self.values:
                output.extend(value.get_hash(platform=platform))

        return output

    def get_api_context(self, is_public=False):
        return {
            'values': [v.get_api_context(is_public=is_public) for v in self.values],
            'hasSystemFrames':
            any(v.stacktrace.get_has_system_frames() for v in self.values if v.stacktrace),
            'excOmitted':
            self.exc_omitted,
        }

    def to_string(self, event, is_public=False, **kwargs):
        if not self.values:
            return ''

        output = []
        for exc in self.values:
            output.append(u'{0}: {1}\n'.format(exc.type, exc.value))
            if exc.stacktrace:
                output.append(
                    exc.stacktrace.
                    get_stacktrace(event, system_frames=False, max_frames=5, header=False) + '\n\n'
                )
        return (''.join(output)).strip()

    def get_stacktrace(self, *args, **kwargs):
        exc = self.values[0]
        if exc.stacktrace:
            return exc.stacktrace.get_stacktrace(*args, **kwargs)
        return ''

    def iter_tags(self):
        if not self.values:
            return

        mechanism = self.values[0].mechanism
        if mechanism:
            for tag in mechanism.iter_tags():
                yield tag


def slim_exception_data(instance, frame_allowance=settings.SENTRY_MAX_STACKTRACE_FRAMES):
    """
    Removes various excess metadata from middle frames which go beyond
    ``frame_allowance``.
    """
    # TODO(dcramer): it probably makes sense to prioritize a certain exception
    # rather than distributing allowance among all exceptions
    frames = []
    for exception in instance.values:
        if not exception.stacktrace:
            continue
        frames.extend(exception.stacktrace.frames)

    slim_frame_data(frames, frame_allowance)
