from sentry.snuba.on_demand_metrics.transpiler import MetricsTranspiler


def test_transpile_fields():
    field = "count(transaction.duration)"
    filters = "transaction.duration:<15m ciao:field"
    transpiler = MetricsTranspiler(field=field, filters=filters)
    transpiler.transpile_filters()
