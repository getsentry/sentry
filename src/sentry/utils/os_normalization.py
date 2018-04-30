from __future__ import absolute_import
import re

# Environment.OSVersion (GetVersionEx) or RuntimeInformation.OSDescription, on Windows
_windows_re = re.compile('^(Microsoft )?Windows (NT )?(?P<version>\d+\.\d+\.\d+).*$')
# Environment.OSVersion or RuntimeInformation.OSDescription (uname)
# on Mono and CoreCLR on macOS, iOS, Linux, etc
_uname_re = re.compile('^(?P<name>[a-zA-Z]+) (?P<version>\d+\.\d+\.\d+(\.[1-9]+)?).*$')


def normalize(data):
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
