try:
    from symsynd.driver import Driver
    from symsynd.report import ReportSymbolizer
    have_symsynd = True
except ImportError:
    have_symsynd = False

from sentry.lang.native.dsymcache import dsymcache


def make_symbolizer(project, binary_images):
    if not have_symsynd:
        raise RuntimeError('symsynd is unavailable.  Install sentry with '
                           'the dsym feature flag.')
    driver = Driver()
    dsym_path, loaded = dsymcache.fetch_dsyms(project,
        [x['uuid'] for x in binary_images])
    return ReportSymbolizer(driver, dsym_path, binary_images)
