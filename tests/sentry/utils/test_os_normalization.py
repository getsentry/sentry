from __future__ import absolute_import
from sentry.utils.os_normalization import normalize


# Environment.OSVersion on Windows 7 (CoreCLR 1.0+, .NET Framework 1.1+, Mono 1+)
def test_windows_7_or_server_2008():
    data = {'name': 'Microsoft Windows NT 6.1.7601 Service Pack 1'}
    normalize(data)
    assert data['name'] == 'Windows'
    assert data['version'] == '6.1.7601'


# Environment.OSVersion on Windows 10 (CoreCLR 1.0+, .NET Framework 1.1+, Mono 1+)
# *or later, due to GetVersionEx deprecated on Windows 8.1
# It's a potentially really misleading API on newer platforms
# Only used if RuntimeInformation.OSDescription is not available (old runtimes)
def test_windows_8_or_server_2012_or_later():
    data = {'name': 'Microsoft Windows NT 6.2.9200.0'}
    normalize(data)
    assert data['name'] == 'Windows'
    assert data['version'] == '6.2.9200'


# RuntimeInformation.OSDescription on Windows 10 (CoreCLR 2.0+, .NET Framework 4.7.1+, Mono 5.4+)
def test_windows_10():
    data = {'name': 'Microsoft Windows 10.0.16299'}
    normalize(data)
    assert data['name'] == 'Windows'
    assert data['version'] == '10.0.16299'


# Environment.OSVersion on macOS (CoreCLR 1.0+, Mono 1+)
def test_macos():
    data = {'name': 'Unix 17.5.0.0'}
    normalize(data)
    assert data['name'] == 'Unix'
    assert data['kernel_version'] == '17.5.0'


# Environment.OSVersion on CentOS 7 (CoreCLR 1.0+, Mono 1+)
def test_centos_os_version():
    data = {'name': 'Unix 3.10.0.693'}
    normalize(data)
    assert data['name'] == 'Unix'
    assert data['kernel_version'] == '3.10.0.693'


# RuntimeInformation.OSDescription on CentOS 7 (CoreCLR 2.0+, Mono 5.4+)
def test_centos_runtime_info():
    data = {'name': 'Linux 3.10.0-693.21.1.el7.x86_64 #1 SMP Wed Mar 7 19:03:37 UTC 2018'}
    normalize(data)
    assert data['name'] == 'Linux'
    assert data['kernel_version'] == '3.10.0'


# RuntimeInformation.OSDescription on macOS (CoreCLR 2.0+, Mono 5.4+)
def test_darwin():
    data = {'name': 'Darwin 17.5.0 Darwin Kernel Version 17.5.0: Mon Mar  5 22:24:32 PST 2018; root:xnu-4570.51.1~1/RELEASE_X86_64'}
    normalize(data)
    assert data['name'] == 'Darwin'
    assert data['kernel_version'] == '17.5.0'


# RuntimeInformation.OSDescription on Windows Subsystem for Linux (Ubuntu) (CoreCLR 2.0+, Mono 5.4+)
def test_wsl_ubuntu():
    data = {'name': 'Linux 4.4.0-43-Microsoft #1-Microsoft Wed Dec 31 14:42:53 PST 2014'}
    normalize(data)
    assert data['name'] == 'Linux'
    assert data['kernel_version'] == '4.4.0'


def test_no_name():
    data = {}
    normalize(data)
    assert 'name' not in data
    assert 'version' not in data
