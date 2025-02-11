import itertools


def value_from_row(row, tagkey):
    return tuple(row[k] for k in tagkey)


def zerofill(data, start, end, rollup, allow_partial_buckets=False, fill_default=None):
    if fill_default is None:
        fill_default = []
    rv = []
    end = int(end.timestamp())
    rollup_start = (int(start.timestamp()) // rollup) * rollup
    rollup_end = (end // rollup) * rollup

    # Fudge the end value when we're only getting a single window.
    # This ensure that we get both values for a single large window that
    # straddles two buckets. An example of this is a 1d window that starts
    # mid day.
    if rollup_end - rollup_start == rollup:
        rollup_end += 1
    i = 0
    for key in range(rollup_start, rollup_end, rollup):
        try:
            while data[i][0] < key:
                rv.append(data[i])
                i += 1
            if data[i][0] == key:
                rv.append(data[i])
                i += 1
                continue
        except IndexError:
            pass

        rv.append((key, fill_default))
    # Add any remaining rows that are not aligned to the rollup and are lower than the
    # end date.
    if i < len(data):
        end_timestamp = end if allow_partial_buckets else rollup_end
        rv.extend(row for row in data[i:] if row[0] < end_timestamp)

    return rv


def calculate_time_frame(start, end, rollup):
    rollup_start = (int(start.timestamp()) // rollup) * rollup
    rollup_end = (int(end.timestamp()) // rollup) * rollup
    if rollup_end - rollup_start == rollup:
        rollup_end += 1
    return {"start": rollup_start, "end": rollup_end}


class BaseSnubaSerializer:
    def __init__(self, organization, lookup, user):
        self.organization = organization
        self.lookup = lookup
        self.user = user

    def get_attrs(self, item_list):
        if self.lookup is None:
            return item_list

        return self.lookup.serializer(self.organization, item_list, self.user)


class SnubaTSResultSerializer(BaseSnubaSerializer):
    """
    Serializer for time-series Snuba data.
    """

    def serialize(
        self,
        result,
        column="count",
        order=None,
        allow_partial_buckets=False,
        zerofill_results=True,
        extra_columns=None,
    ):
        data = [
            (key, list(group))
            for key, group in itertools.groupby(result.data["data"], key=lambda r: r["time"])
        ]
        attrs = {}
        if self.lookup:
            attrs = self.get_attrs(
                [value_from_row(r, self.lookup.columns) for _, v in data for r in v]
            )
        rv = []
        for k, v in data:
            row = []
            for r in v:
                item = {"count": r.get(column, 0)}
                if extra_columns is not None:
                    for extra_column in extra_columns:
                        item[extra_column] = r.get(extra_column, 0)
                if self.lookup:
                    value = value_from_row(r, self.lookup.columns)
                    item[self.lookup.name] = (attrs.get(value),)
                row.append(item)
            rv.append((k, row))

        res = {
            "data": (
                zerofill(
                    rv,
                    result.start,
                    result.end,
                    result.rollup,
                    allow_partial_buckets=allow_partial_buckets,
                )
                if zerofill_results
                else rv
            )
        }

        confidence_values = []
        # TODO: remove this once frontend starts using `accuracy` in `meta`
        if "processed_timeseries" in result.data:
            for key, group in itertools.groupby(
                result.data["processed_timeseries"].confidence, key=lambda r: r["time"]
            ):
                result_row = []
                for confidence_row in group:
                    item = {column: confidence_row.get(column, None)}
                    if extra_columns is not None:
                        for extra_column in extra_columns:
                            item[extra_column] = confidence_row.get(extra_column, 0)
                    if self.lookup:
                        value = value_from_row(confidence_row, self.lookup.columns)
                        item[self.lookup.name] = (attrs.get(value),)
                    result_row.append(item)
                confidence_values.append((key, result_row))
            # confidence only comes from the RPC which already helps us zerofill by returning all buckets
            res["confidence"] = confidence_values

        if result.data.get("totals"):
            res["totals"] = {"count": result.data["totals"][column]}
        # If order is passed let that overwrite whats in data since its order for multi-axis
        if order is not None:
            res["order"] = order
        elif "order" in result.data:
            res["order"] = result.data["order"]
        res["isMetricsData"] = result.data.get("isMetricsData", False)

        if hasattr(result, "start") and hasattr(result, "end"):
            timeframe = calculate_time_frame(result.start, result.end, result.rollup)
            res["start"] = timeframe["start"]
            res["end"] = timeframe["end"]

        return res
