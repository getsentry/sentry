from sentry import analytics


class JsSdkLoaderRendered(analytics.Event):
    type = "js_sdk_loader.rendered"

    attributes = (
        analytics.Attribute("org_id"),
        analytics.Attribute("is_lazy"),
        analytics.Attribute("has_performance"),
        analytics.Attribute("has_replay"),
        analytics.Attribute("has_debug"),
        analytics.Attribute("sdk_version"),
        analytics.Attribute("tmpl"),
    )


analytics.register(JsSdkLoaderRendered)
