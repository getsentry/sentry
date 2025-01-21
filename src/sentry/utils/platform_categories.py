from django.utils.translation import gettext_lazy as _

# Mirrors `const frontend` in sentry/static/app/data/platformCategories.tsx
# When changing this file, make sure to keep sentry/static/app/data/platformCategories.tsx in sync.
FRONTEND = {
    "dart",
    "javascript",
    "javascript-react",
    "javascript-angular",
    "javascript-angularjs",
    "javascript-backbone",
    "javascript-ember",
    "javascript-gatsby",
    "javascript-vue",
    "javascript-nuxt",
    "javascript-nextjs",
    "javascript-remix",
    "javascript-solid",
    "javascript-solidstart",
    "javascript-svelte",
    "javascript-sveltekit",
    "javascript-astro",
    "unity",
}

# Mirrors `const mobile` in sentry/static/app/data/platformCategories.tsx
# When changing this file, make sure to keep sentry/static/app/data/platformCategories.tsx in sync.

MOBILE = {
    "android",
    "apple-ios",
    "cordova",
    "capacitor",
    "javascript-cordova",
    "javascript-capacitor",
    "ionic",
    "react-native",
    "flutter",
    "dart-flutter",
    "unity",
    "dotnet-maui",
    "dotnet-xamarin",
    "unreal",
    # Old platforms
    "java-android",
    "cocoa-objc",
    "cocoa-swift",
}

# Mirrors `const backend` in sentry/static/app/data/platformCategories.tsx
# When changing this file, make sure to keep sentry/static/app/data/platformCategories.tsx in sync.
BACKEND = {
    "bun",
    "deno",
    "dotnet",
    "dotnet-aspnet",
    "dotnet-aspnetcore",
    "elixir",
    "go",
    "go-echo",
    "go-fasthttp",
    "go-fiber",
    "go-gin",
    "go-http",
    "go-iris",
    "go-martini",
    "go-negroni",
    "java",
    "java-appengine",
    "java-log4j",
    "java-log4j2",
    "java-logback",
    "java-logging",
    "java-spring-boot",
    "java-spring",
    "kotlin",
    "native",
    "node",
    "node-cloudflare-pages",
    "node-cloudflare-workers",
    "node-connect",
    "node-express",
    "node-fastify",
    "node-hapi",
    "node-koa",
    "node-nestjs",
    "perl",
    "php-laravel",
    "php-monolog",
    "php-symfony",
    "php",
    "powershell",
    "python",
    "python-aiohttp",
    "python-asgi",
    "python-bottle",
    "python-celery",
    "python-chalice",
    "python-django",
    "python-falcon",
    "python-fastapi",
    "python-flask",
    "python-pylons",
    "python-pymongo",
    "python-pyramid",
    "python-quart",
    "python-rq",
    "python-sanic",
    "python-starlette",
    "python-tornado",
    "python-tryton",
    "python-wsgi",
    "ruby",
    "ruby-rack",
    "ruby-rails",
    "rust",
}

# Mirrors `const serverless` in sentry/static/app/data/platformCategories.tsx
# When changing this file, make sure to keep sentry/static/app/data/platformCategories.tsx in sync.
SERVERLESS = {
    "dotnet-awslambda",
    "dotnet-gcpfunctions",
    "node-awslambda",
    "node-azurefunctions",
    "node-gcpfunctions",
    "node-cloudflare-workers",
    "python-awslambda",
    "python-azurefunctions",
    "python-gcpfunctions",
    "python-serverless",
}

# Mirrors `const desktop` in sentry/static/app/data/platformCategories.tsx
# When changing this file, make sure to keep sentry/static/app/data/platformCategories.tsx in sync.
DESKTOP = {
    "apple-macos",
    "dotnet",
    "dotnet-maui",
    "dotnet-winforms",
    "dotnet-wpf",
    "electron",
    "flutter",
    "java",
    "javascript-electron",
    "kotlin",
    "minidump",
    "native",
    "native-breakpad",
    "native-crashpad",
    "native-minidump",
    "native-qt",
    "unity",
    "unreal",
}

# TODO: @athena Remove this
# This is only temporary since we decide the right category. Don't add anything here or your frontend experience will be broken
TEMPORARY = {"nintendo"}

CATEGORY_LIST = [
    {id: "browser", "name": _("Browser"), "platforms": FRONTEND},
    {id: "server", "name": _("Server"), "platforms": BACKEND},
    {id: "mobile", "name": _("Mobile"), "platforms": MOBILE},
    {id: "desktop", "name": _("Desktop"), "platforms": DESKTOP},
    {id: "serverless", "name": _("Serverless"), "platforms": SERVERLESS},
    {id: "temporary", "name": _("Temporary"), "platforms": TEMPORARY},
]

# Mirrors `const sourceMaps` in sentry/static/app/data/platformCategories.tsx
# When changing this file, make sure to keep sentry/static/app/data/platformCategories.tsx in sync.
SOURCE_MAPS = {
    *FRONTEND,
    "react-native",
    "cordova",
    "electron",
}
