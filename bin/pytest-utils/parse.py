import re

TESTLINE = re.compile(r"(?P<duration>\d+.\d+?)s\s+?(?P<type>\w+?)\s+?(?P<path>[\w/:.]+)")


def _split_path(test_path):
    dirs = test_path.split('/')
    trace = dirs.pop().split('::')
    return dirs + trace


def extract_tests(lines):
    # lines should be the output of py.test --durations=0
    for l in lines:
        m = TESTLINE.match(l)
        if m:
            d = m.groupdict()
            # call times are a much more consistent and reliable metric
            # than setup or teardown times, which vary depending on what
            # tests are called and how pytest caches fixtures and such
            if d['type'] == 'call':
                yield _split_path(d.pop('path')), float(d['duration'])
