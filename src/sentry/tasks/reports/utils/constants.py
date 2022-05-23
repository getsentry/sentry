from datetime import timedelta

BATCH_SIZE = 20000

# TODO(mgaeta): it's kind of silly for this source of truth to live here.
ONE_DAY = int(timedelta(days=1).total_seconds())
