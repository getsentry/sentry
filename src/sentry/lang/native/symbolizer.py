try:
    from symsynd.driver import Driver
    from symsynd.report import ReportSymbolizer
    have_symsynd = True
except ImportError:
    have_symsynd = False

from sentry import options
from sentry.lang.native.dsymcache import dsymcache


def make_symbolizer(project, binary_images, threads=None):
    """Creates a symbolizer for the given project and binary images.  If a
    list of threads is referenced (from an apple crash report) then only
    images needed by those frames are loaded.
    """
    if not have_symsynd:
        raise RuntimeError('symsynd is unavailable.  Install sentry with '
                           'the dsym feature flag.')
    driver = Driver(options.get('dsym.llvm-symbolizer-path') or None)

    if threads is None:
        to_load = [x['uuid'] for x in binary_images]
    else:
        image_map = {}
        for image in binary_images:
            image_map[image['image_addr']] = image['uuid']
        to_load = set()
        for thread in threads:
            for frame in thread['backtrace']['contents']:
                img_uuid = image_map.get(frame['object_addr'])
                if img_uuid is not None:
                    to_load.add(img_uuid)
        to_load = list(to_load)

    dsym_paths, loaded = dsymcache.fetch_dsyms(project, to_load)
    return ReportSymbolizer(driver, dsym_paths, binary_images)
