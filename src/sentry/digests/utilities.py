from collections import Counter


# TODO(tkaemming): This should probably just be part of `build_digest`.
def get_digest_metadata(digest):
    start = None
    end = None

    counts = Counter()
    for rule, groups in digest.iteritems():
        counts.update(groups.keys())

        for group, records in groups.iteritems():
            for record in records:
                if start is None or record.datetime < start:
                    start = record.datetime

                if end is None or record.datetime > end:
                    end = record.datetime

    return start, end, counts
