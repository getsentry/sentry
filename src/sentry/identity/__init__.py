from .manager import IdentityManager

default_manager = IdentityManager()
all = default_manager.all
get = default_manager.get
exists = default_manager.exists
register = default_manager.register
unregister = default_manager.unregister
is_login_provider = default_manager.is_login_provider


def _register_providers() -> None:
    from .bitbucket.provider import BitbucketIdentityProvider
    from .discord.provider import DiscordIdentityProvider
    from .github.provider import GitHubIdentityProvider
    from .github_enterprise.provider import GitHubEnterpriseIdentityProvider
    from .gitlab.provider import GitlabIdentityProvider
    from .google.provider import GoogleIdentityProvider
    from .slack.provider import SlackIdentityProvider
    from .vercel.provider import VercelIdentityProvider
    from .vsts.provider import VSTSIdentityProvider, VSTSNewIdentityProvider
    from .vsts_extension.provider import VstsExtensionIdentityProvider

    # TODO(epurkhiser): Should this be moved into it's own plugin, it should be
    # initialized there.
    register(SlackIdentityProvider)
    register(GitHubIdentityProvider)
    register(GitHubEnterpriseIdentityProvider)
    register(VSTSNewIdentityProvider)
    register(VSTSIdentityProvider)
    register(VstsExtensionIdentityProvider)
    register(VercelIdentityProvider)
    register(BitbucketIdentityProvider)
    register(GitlabIdentityProvider)
    register(GoogleIdentityProvider)
    register(DiscordIdentityProvider)


_register_providers()
