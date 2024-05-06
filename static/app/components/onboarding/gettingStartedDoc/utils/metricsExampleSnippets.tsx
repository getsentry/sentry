const JSCounterSnippet = `
// Increment a counter by one for each button click.
Sentry.metrics.increment("button_click", 1, {
  tags: { browser: "Firefox", region: "EU" },
});`;

const JSDistributionSnippet = `
// Add '15.0' to a distribution
// used for tracking the loading times of a component.
Sentry.metrics.distribution("component_load_time", 15.0, {
  tags: { type: "important" },
  unit: "millisecond",
});`;

const JSGaugeSnippet = `
// Add 34% to a gauge tracking CPU usage.
Sentry.metrics.gauge("cpu_usage", 34, {
  tags: { os: "MacOS" },
  unit: "percent",
});`;

const JSSetSnippet = `
// Add 'jane' to a set
// used for tracking the number of users that viewed a page.
Sentry.metrics.set("user_view", "jane");`;

const javascript = {
  counter: JSCounterSnippet,
  distribution: JSDistributionSnippet,
  gauge: JSGaugeSnippet,
  set: JSSetSnippet,
};

const pythonCounterSnippet = `
# Increment a counter by one for each button click.
sentry_sdk.metrics.incr(
	key="button_click",
	value=1,
	tags={
		"browser": "Firefox",
		"region": "EU"
	}
)`;

const pythonDistributionSnippet = `
# Add '15.0' to a distribution
# used for tracking the loading times of a component.
sentry_sdk.metrics.distribution(
	key="page_load",
	value=15.0,
	unit="millisecond",
	tags={
		"page": "/home"
	}
)`;

const pythonGaugeSnippet = `
# Add '15.0' to a gauge
# used for tracking the loading times for a page.
sentry_sdk.metrics.gauge(
	key="page_load",
	value=15.0,
	unit="millisecond",
	tags={
		"page": "/home"
	}
)`;

const pythonSetSnippet = `
# Add 'jane' to a set
# used for tracking the number of users that viewed a page.
sentry_sdk.metrics.set(
	key="user_view",
	value="jane",
	unit="username",
	tags={
		"page": "/home"
	}
)`;

const python = {
  counter: pythonCounterSnippet,
  distribution: pythonDistributionSnippet,
  gauge: pythonGaugeSnippet,
  set: pythonSetSnippet,
};

const dotnetCounterSnippet = `
// Incrementing a counter by one for each button click.
SentrySdk.Metrics.Increment("ButtonClicked",
    tags: new Dictionary<string, string> {{ "region", "us-west-1" }});`;

const dotnetDistributionSnippet = `
// Add '15' to a distribution used to track the loading time.
SentrySdk.Metrics.Distribution("LoadingTime",
    15,
    unit: MeasurementUnit.Duration.Millisecond,
    tags: new Dictionary<string, string> {{ "region", "us-west-1" }})`;

const dotnetGaugeSnippet = `
// Adding '15' to a gauge used to track the loading time.
SentrySdk.Metrics.Gauge("LoadingTime",
    15,
    unit: MeasurementUnit.Duration.Millisecond,
    tags: new Dictionary<string, string> {{ "region", "us-west-1" }});`;

const dotnetSetSnippet = `
// Adding a set of unique occurrences.
SentrySdk.Metrics.Set("UserView", "Rufus",
    unit: MeasurementUnit.Custom("username"),
    tags: new Dictionary<string, string> {{ "region", "us-west-1" }});
`;

const dotnet = {
  counter: dotnetCounterSnippet,
  distribution: dotnetDistributionSnippet,
  gauge: dotnetGaugeSnippet,
  set: dotnetSetSnippet,
};

const rubyCounterSnippet = `
# Incrementing a counter by one for each button click.
Sentry::Metrics.increment('button_click', 1, tags: {
  browser: 'firefox'
})`;

const rubyDistributionSnippet = `
# Add '15' to a distribution used to track the loading time.
Sentry::Metrics.distribution(
  'page_load',
  15.0,
  unit: 'millisecond',
  tags: { page: '/home' }
)`;

const rubyGaugeSnippet = `
# Add '15.0' to a gauge used for tracking the loading times for a page.
Sentry::Metrics.gauge('page_load', 15.0, unit: 'millisecond')`;

const rubySetSnippet = `
# Add 'jane' to a set
# used for tracking the number of users that viewed a page.
Sentry::Metrics.set('user_view', 'jane', unit: 'username')`;

const ruby = {
  counter: rubyCounterSnippet,
  distribution: rubyDistributionSnippet,
  gauge: rubyGaugeSnippet,
  set: rubySetSnippet,
};

const dartCounterSnippet = `
// Incrementing a counter by one for each button click.
Sentry.metrics().increment(
  'button_login_click', // key
  value: 1,
  unit: null,
  tags: {'provider': 'e-mail'},
);`;

const dartDistributionSnippet = `
// Add '15' to a distribution
// used to track the loading time of an image.
Sentry.metrics().distribution(
  'image_download_duration', // key
  value: 150,
  unit: DurationSentryMeasurementUnit.milliSecond,
  tags: {'type': 'thumbnail'},
);`;

const dartGaugeSnippet = `
// Add '15.0' to a gauge
// used for tracking the loading times for a page.
Sentry.metrics().gauge(
  'page_load', // key
  value: 15,
  unit: DurationSentryMeasurementUnit.milliSecond,
  tags: {'page': '/home'},
);`;

const dartSetSnippet = `
// Add 'jane' to a set
// used for tracking the number of users that viewed a page.
Sentry.metrics().set(
  'user_view', // key
  stringValue: 'jane',
  unit: CustomSentryMeasurementUnit('username'),
  tags: {'page': 'home'},
);`;

const dart = {
  counter: dartCounterSnippet,
  distribution: dartDistributionSnippet,
  gauge: dartGaugeSnippet,
  set: dartSetSnippet,
};

const phpCounterSnippet = `
// Increment a counter by one for each button click.
\\Sentry\\metrics()->increment(
    key: 'button_click',
    value: 1,
    tags: [
        'browser' => 'Firefox',
        'region' => 'EU',
    ],
)`;

const phpDistributionSnippet = `
// Add '15.0' to a distribution
// used for tracking the loading times per page.
\\Sentry\\metrics()->distribution(
    key: 'page_load',
    value: 15.0,
    unit: \\Sentry\\Metrics\\MetricsUnit::millisecond(),
    tags: [
        'page' => '/home',
    ],
)`;

const phpGaugeSnippet = `
// Add '15.0' to a gauge
// used for tracking the loading times for a page.
\\Sentry\\metrics()->gauge(
    key: 'page_load',
    value: 15.0,
    unit: \\Sentry\\Metrics\\MetricsUnit::millisecond(),
    tags: [
        'page' => '/home',
    ],
)`;

const phpSetSnippet = `
// Add 'jane' to a set
// used for tracking the number of users that viewed a page.
\\Sentry\\metrics()->set(
    key: 'user_view',
    value: 'jane',
    unit: \\Sentry\\Metrics\\MetricsUnit::custom('username'),
    tags: [
        'page' => '/home',
    ],
)
`;

const php = {
  counter: phpCounterSnippet,
  distribution: phpDistributionSnippet,
  gauge: phpGaugeSnippet,
  set: phpSetSnippet,
};

const exampleSnippets = {
  dart,
  dotnet,
  javascript,
  php,
  python,
  ruby,
};

export default exampleSnippets;
