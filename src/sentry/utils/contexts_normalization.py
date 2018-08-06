from __future__ import absolute_import
import re

# Environment.OSVersion (GetVersionEx) or RuntimeInformation.OSDescription, on Windows
_windows_re = re.compile('^(Microsoft )?Windows (NT )?(?P<version>\d+\.\d+\.\d+).*$')
# Environment.OSVersion or RuntimeInformation.OSDescription (uname)
# on Mono and CoreCLR on macOS, iOS, Linux, etc
_uname_re = re.compile('^(?P<name>[a-zA-Z]+) (?P<version>\d+\.\d+\.\d+(\.[1-9]+)?).*$')
# Mono 5.4, .NET Core 2.0
_runtime_re = re.compile('^(?P<name>.*) (?P<version>\d+\.\d+(\.\d+){0,2}).*$')


def normalize_os(data):
    raw_description = data.get('raw_description')
    # If there's no name and version, attempts to infer from raw_description
    if raw_description is not None \
            and data.get('name') is None \
            and data.get('version') is None:
        r = _windows_re.search(raw_description)
        if r:
            data['name'] = 'Windows'
            data['version'] = r.group('version')
        else:
            r = _uname_re.search(raw_description)
            if r:
                data['name'] = r.group('name')
                data['kernel_version'] = r.group('version')


def normalize_runtime(data):
    raw_description = data.get('raw_description')
    # If there's no name and version, attempts to infer from raw_description
    if raw_description is not None \
            and data.get('name') is None \
            and data.get('version') is None:
        r = _runtime_re.search(raw_description)
        if r:
            data['name'] = r.group('name')
            data['version'] = r.group('version')

    # RuntimeInformation.FrameworkDescription doesn't return a very useful value.
    # example: .NET Framework 4.7.3056.0
    # Release key dug from registry and sent as #build
    if data.get('name').startswith('.NET Framework'):
        build = data.get('build')

        if build is not None:
            version_map = {
                "378389": "4.5",
                "378675": "4.5.1",
                "378758": "4.5.1",
                "379893": "4.5.2",
                "393295": "4.6",
                "393297": "4.6",
                "394254": "4.6.1",
                "394271": "4.6.1",
                "394802": "4.6.2",
                "394806": "4.6.2",
                "460798": "4.7",
                "460805": "4.7",
                "461308": "4.7.1",
                "461310": "4.7.1",
                "461808": "4.7.2",
                "461814": "4.7.2",
            }
            version = version_map.get(build, None)
            if version is not None:
                data['version'] = version
