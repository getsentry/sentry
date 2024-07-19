import importlib

from django.http import HttpResponse
from django.urls import URLResolver, get_resolver

from sentry.middleware.integrations.classifications import IntegrationClassification


def extract_matching_url_patterns(urlpatterns, base: str = ""):
    for pattern in urlpatterns:
        if isinstance(pattern, URLResolver):
            yield from extract_matching_url_patterns(
                pattern.url_patterns, base + str(pattern.pattern)
            )
        else:
            url_pattern = base + str(pattern.pattern)
            url_pattern = url_pattern.replace("/^", "/")
            if "extensions/" in url_pattern:
                yield url_pattern


def test_parsers_for_all_extension_urls():
    """
    Ensure that we have a request parser for all defined integrations.
    """
    classifier = IntegrationClassification(lambda req: HttpResponse())
    url_patterns = extract_matching_url_patterns(get_resolver().url_patterns)
    for pattern in url_patterns:
        [_, provider, _trailing] = pattern.split("/", maxsplit=2)

        # Ignore dynamic segments
        if provider[0] in {"(", "["} or provider == "external-install":
            continue

        # Ensure the expected module exists
        provider = provider.replace("-", "_")
        parser_module = f"sentry.middleware.integrations.parsers.{provider}"
        try:
            importlib.import_module(parser_module)
        except ImportError:
            msg = f"""
        Could not import parser module `{parser_module}` for provider `{provider}`.

        Without a request parser for the {provider} integration, the integration
        will not behave correctly in saas.
            """
            assert False, msg

        # Ensure that the parser is wired into the integration classifier
        msg = f"""
        Could not access the parser for {provider}.

        Ensure that the {provider} is registered with

        sentry.middleware.integrations.classifications.IntegrationClassification
        """
        assert classifier.integration_parsers.get(provider), msg
