from __future__ import absolute_import

from sentry.lang.native.itc import Itc


def test_itc():
    import pprint
    itc = Itc('username', 'pw')
    pprint.pprint(itc.to_json())
    for app in itc.iter_apps():
        pprint.pprint(app)
        for build in itc.iter_app_builds(app['id']):
            # print '       ', build
            # (self, app_id, platform, version, build_id):
            print '       ', itc.get_dsym_url(app['id'], build['platform'], build['version'], build['build_id'])
    itc.close()
