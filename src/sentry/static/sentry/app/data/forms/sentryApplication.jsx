const forms = [
  {
    // Form "section"/"panel"
    title: 'Application Details',
    fields: [
      {
        name: 'name',
        type: 'string',
        required: true,
        placeholder: 'e.g. My Application',
        // additional data/props that is related to rendering of form field rather than data
        label: 'Name',
        help: 'Human readable name of your application.',
      },
      {
        name: 'webhook_url',
        type: 'string',
        required: true,
        label: 'Webhook URL',
        placeholder: 'e.g. https://example.com/sentry/webhook/',
        help: 'The URL Sentry will make requests to on installation changes.',
      },
      {
        name: 'redirect_url',
        type: 'string',
        label: 'Redirect URL',
        placeholder: 'e.g. https://example.com/sentry/setup/',
        help: 'The URL Sentry will redirect users after installation.',
      },
      {
        name: 'overview',
        type: 'textarea',
        label: 'Overview',
        placeholder: 'Put whatever you want here...',
        help: "Description of your application and it's functionality.",
      },
    ],
  },
];

export default forms;
