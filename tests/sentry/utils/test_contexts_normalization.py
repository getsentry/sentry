from __future__ import absolute_import
from sentry.utils.contexts_normalization import normalize_os, normalize_runtime
from sentry.testutils import TestCase


class NormalizeRuntimeTests(TestCase):
    def test_dotnet_framework_472(self):
        data = {'raw_description': '.NET Framework 4.7.3056.0', 'build': "461814"}
        normalize_runtime(data)
        assert data['name'] == '.NET Framework'
        assert data['version'] == '4.7.2'

    def test_dotnet_framework_future_version(self):
        # Unmapped build number doesn't override version
        data = {'raw_description': '.NET Framework 200.0', 'build': "999999"}
        normalize_runtime(data)
        assert data['name'] == '.NET Framework'
        assert data['version'] == '200.0'

    def test_dotnet_native(self):
        data = {'raw_description': '.NET Native 2.0'}
        normalize_runtime(data)
        assert data['name'] == '.NET Native'
        assert data['version'] == '2.0'

    def test_dotnet_core(self):
        data = {'raw_description': '.NET Core 2.0'}
        normalize_runtime(data)
        assert data['name'] == '.NET Core'
        assert data['version'] == '2.0'


class NormalizeOsTests(TestCase):
    # Environment.OSVersion on Windows 7 (CoreCLR 1.0+, .NET Framework 1.1+, Mono 1+)
    def test_windows_7_or_server_2008(self):
        data = {'raw_description': 'Microsoft Windows NT 6.1.7601 Service Pack 1'}
        normalize_os(data)
        assert data['name'] == 'Windows'
        assert data['version'] == '6.1.7601'

    # Environment.OSVersion on Windows 10 (CoreCLR 1.0+, .NET Framework 1.1+, Mono 1+)
    # *or later, due to GetVersionEx deprecated on Windows 8.1
    # It's a potentially really misleading API on newer platforms
    # Only used if RuntimeInformation.OSDescription is not available (old runtimes)
    def test_windows_8_or_server_2012_or_later(self):
        data = {'raw_description': 'Microsoft Windows NT 6.2.9200.0'}
        normalize_os(data)
        assert data['name'] == 'Windows'
        assert data['version'] == '6.2.9200'

    # RuntimeInformation.OSDescription on Windows 10 (CoreCLR 2.0+, .NET Framework 4.7.1+, Mono 5.4+)
    def test_windows_10(self):
        data = {'raw_description': 'Microsoft Windows 10.0.16299'}
        normalize_os(data)
        assert data['name'] == 'Windows'
        assert data['version'] == '10.0.16299'

    # Environment.OSVersion on macOS (CoreCLR 1.0+, Mono 1+)
    def test_macos(self):
        data = {'raw_description': 'Unix 17.5.0.0'}
        normalize_os(data)
        assert data['name'] == 'Unix'
        assert data['kernel_version'] == '17.5.0'

    # Environment.OSVersion on CentOS 7 (CoreCLR 1.0+, Mono 1+)
    def test_centos_os_version(self):
        data = {'raw_description': 'Unix 3.10.0.693'}
        normalize_os(data)
        assert data['name'] == 'Unix'
        assert data['kernel_version'] == '3.10.0.693'

    # RuntimeInformation.OSDescription on CentOS 7 (CoreCLR 2.0+, Mono 5.4+)
    def test_centos_runtime_info(self):
        data = {'raw_description': 'Linux 3.10.0-693.21.1.el7.x86_64 #1 SMP Wed Mar 7 19:03:37 UTC 2018'}
        normalize_os(data)
        assert data['name'] == 'Linux'
        assert data['kernel_version'] == '3.10.0'

    # RuntimeInformation.OSDescription on macOS (CoreCLR 2.0+, Mono 5.4+)
    def test_darwin(self):
        data = {'raw_description': 'Darwin 17.5.0 Darwin Kernel Version 17.5.0: Mon Mar  5 22:24:32 PST 2018; root:xnu-4570.51.1~1/RELEASE_X86_64'}
        normalize_os(data)
        assert data['name'] == 'Darwin'
        assert data['kernel_version'] == '17.5.0'

    # RuntimeInformation.OSDescription on Windows Subsystem for Linux (Ubuntu) (CoreCLR 2.0+, Mono 5.4+)
    def test_wsl_ubuntu(self):
        data = {'raw_description': 'Linux 4.4.0-43-Microsoft #1-Microsoft Wed Dec 31 14:42:53 PST 2014'}
        normalize_os(data)
        assert data['name'] == 'Linux'
        assert data['kernel_version'] == '4.4.0'

    def test_name_not_overwritten(self):
        data = {'name': 'Properly defined name', 'raw_description': 'Linux 4.4.0'}
        normalize_os(data)
        assert data['name'] == 'Properly defined name'

    def test_version_not_overwritten(self):
        data = {'version': 'Properly defined version', 'raw_description': 'Linux 4.4.0'}
        normalize_os(data)
        assert data['version'] == 'Properly defined version'

    def test_no_name(self):
        data = {}
        normalize_os(data)
        assert 'name' not in data
        assert 'version' not in data
        assert 'kernel_version' not in data
        assert 'raw_description' not in data
