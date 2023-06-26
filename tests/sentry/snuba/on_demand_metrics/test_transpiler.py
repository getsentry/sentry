from sentry.snuba.on_demand_metrics.transpiler import MetricsTranspiler


def test_transpile_fields():
    field = "count(transaction.duration)"
    filters = "transaction:/transcation AND location:italy OR hello:print"
    transpiler = MetricsTranspiler(field=field, filters=filters)
    transpiler.transpile_filters()
