# Mirrors sentry/static/app/data/platformCategories.tsx
# When changing this file, make sure to keep sentry/static/app/data/platformCategories.tsx in sync.

from django.utils.translation import ugettext_lazy as _

POPULAR_PLATFORM_CATEGORIES = [
    "javascript",
    "javascript-react",
    "javascript-nextjs",
    "python-django",
    "python",
    "python-flask",
    "python-fastapi",
    "ruby-rails",
    "node-express",
    "php-laravel",
    "java",
    "java-spring-boot",
    "dotnet",
    "dotnet-aspnetcore",
    "csharp",
    "go",
    "php",
    "ruby",
    "node",
    "react-native",
    "javascript-angular",
    "javascript-vue",
    "android",
    "apple-ios",
    "flutter",
    "dart-flutter",
    "unity",
]

FRONTEND = [
    "dart",
    "javascript",
    "javascript-react",
    "javascript-angular",
    "javascript-angularjs",
    "javascript-backbone",
    "javascript-ember",
    "javascript-gatsby",
    "javascript-vue",
    "javascript-nextjs",
    "javascript-remix",
    "javascript-svelte",
    "javascript-sveltekit",
    "unity",
]

MOBILE = [
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
]

BACKEND = [
    "dotnet",
    "dotnet-aspnetcore",
    "dotnet-aspnet",
    "elixir",
    "go",
    "go-http",
    "java",
    "java-appengine",
    "java-log4j",
    "java-log4j2",
    "java-logback",
    "java-logging",
    "java-spring",
    "java-spring-boot",
    "native",
    "node",
    "node-express",
    "node-koa",
    "node-connect",
    "perl",
    "php",
    "php-laravel",
    "php-monolog",
    "php-symfony2",
    "python",
    "python-django",
    "python-flask",
    "python-fastapi",
    "python-starlette",
    "python-sanic",
    "python-celery",
    "python-bottle",
    "python-pylons",
    "python-pyramid",
    "python-tornado",
    "python-rq",
    "ruby",
    "ruby-rails",
    "ruby-rack",
    "rust",
    "kotlin",
]

SERVERLESS = [
    "python-awslambda",
    "python-azurefunctions",
    "python-gcpfunctions",
    "node-awslambda",
    "node-azurefunctions",
    "node-gcpfunctions",
    "dotnet-awslambda",
    "dotnet-gcpfunctions",
]

DESKTOP = [
    "apple-macos",
    "dotnet",
    "dotnet-winforms",
    "dotnet-wpf",
    "dotnet-maui",
    "java",
    "electron",
    "javascript-electron",
    "native",
    "native-crashpad",
    "native-breakpad",
    "native-minidump",
    "native-qt",
    "minidump",
    "unity",
    "flutter",
    "kotlin",
    "unreal",
]

CATEGORY_LIST = [
    {id: "popular", "name": _("Popular"), "platforms": POPULAR_PLATFORM_CATEGORIES},
    {id: "browser", "name": _("Browser"), "platforms": FRONTEND},
    {id: "server", "name": _("Server"), "platforms": BACKEND},
    {id: "mobile", "name": _("Mobile"), "platforms": MOBILE},
    {id: "desktop", "name": _("Desktop"), "platforms": DESKTOP},
    {id: "serverless", "name": _("Serverless"), "platforms": SERVERLESS},
]

SOURCE_MAPS = FRONTEND + [
    "react-native",
    "cordova",
    "electron",
]

TRACING = [
    "python-tracing",
    "node-tracing",
    "react-native-tracing",
]

PERFORMANCE = [
    "javascript",
    "javascript-ember",
    "javascript-react",
    "javascript-vue",
    "php",
    "php-laravel",
    "python",
    "python-django",
    "python-flask",
    "python-fastapi",
    "python-starlette",
    "python-sanic",
    "python-celery",
    "python-bottle",
    "python-pylons",
    "python-pyramid",
    "python-tornado",
    "python-rq",
    "node",
    "node-express",
    "node-koa",
    "node-connect",
]

# List of platforms that have performance onboarding checklist content
WITH_PERFORMANCE_ONBOARDING = [
    "javascript",
    "javascript-react",
]

# List of platforms that do not have performance support. We make use of this list in the product to not provide any Performance
# views such as Performance onboarding checklist.
WITHOUT_PERFORMANCE_SUPPORT = [
    "elixir",
    "minidump",
]

RELEASE_HEALTH = [
    # frontend
    "javascript",
    "javascript-react",
    "javascript-angular",
    "javascript-angularjs",
    "javascript-backbone",
    "javascript-ember",
    "javascript-gatsby",
    "javascript-vue",
    "javascript-nextjs",
    "javascript-remix",
    "javascript-svelte",
    "javascript-sveltekit",
    # mobile
    "android",
    "apple-ios",
    "cordova",
    "javascript-cordova",
    "react-native",
    "flutter",
    "dart-flutter",
    # backend
    "native",
    "node",
    "node-express",
    "node-koa",
    "node-connect",
    "python",
    "python-django",
    "python-flask",
    "python-fastapi",
    "python-starlette",
    "python-sanic",
    "python-celery",
    "python-bottle",
    "python-pylons",
    "python-pyramid",
    "python-tornado",
    "python-rq",
    "rust",
    # serverless
    # desktop
    "apple-macos",
    "native",
    "native-crashpad",
    "native-breakpad",
    "native-qt",
]

# Additional aliases used for filtering in the platform picker
FILTER_ALIAS = {
    "native": ["cpp", "c++"],
}
