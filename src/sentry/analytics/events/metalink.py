from sentry import analytics


class MetaLinkScrapedEvent(analytics.Event):
    type = "metalink.scraped"

    attributes = (analytics.Attribute("provider"),)


class SharedMetaLinkScrapedEvent(analytics.Event):
    type = "metalink.shared.scraped"

    attributes = (analytics.Attribute("provider"),)


analytics.register(MetaLinkScrapedEvent)
analytics.register(SharedMetaLinkScrapedEvent)
