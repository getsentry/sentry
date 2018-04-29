from __future__ import absolute_import
import re

# Environment.OSVersion (GetVersionEx) or RuntimeInformation.OSDescription, on Windows
windows = re.compile('^(Microsoft )?Windows (NT )?(?P<version>\d+\.\d+\.\d+).*$')
# Environment.OSVersion or RuntimeInformation.OSDescription (uname)
# on Mono and CoreCLR on macOS, iOS, Linux, etc
uname = re.compile('^(?P<name>[a-zA-Z]+) (?P<version>\d+\.\d+\.\d+(\.[1-9]+)?).*$')


# If there's no name and version, attempts to infer from raw_description
def normalize(data):
    raw_description = data.get('raw_description', None)
    if raw_description is not None \
            and data.get('name', None) is None \
            and data.get('version', None) is None:
        r = windows.search(raw_description)
        if r:
            data['name'] = 'Windows'
            data['version'] = r.group('version')
        else:
            r = uname.search(raw_description)
            if r:
                data['name'] = r.group('name')
                data['kernel_version'] = r.group('version')
