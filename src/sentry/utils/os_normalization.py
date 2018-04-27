from __future__ import absolute_import
import re

# Environment.OSVersion (GetVersionEx) or RuntimeInformation.OSDescription, on Windows
windows = re.compile('^(Microsoft )?Windows (NT )?(?P<version>\d+\.\d+\.\d+).*$')
# Environment.OSVersion or RuntimeInformation.OSDescription (uname)
# on Mono and CoreCLR on macOS, iOS, Linux, etc
uname = re.compile('^(?P<name>[a-zA-Z]+) (?P<kernel_version>\d+\.\d+\.\d+(\.[1-9]+)?).*$')


def normalize(data):
    name = data.get('name', None)
    if name is not None:
        r = windows.search(name)
        if r:
            data['name'] = 'Windows'
            data['version'] = r.group('version')
        else:
            r = uname.search(name)
            if r:
                data['name'] = r.group('name')
                data['kernel_version'] = r.group('kernel_version')
