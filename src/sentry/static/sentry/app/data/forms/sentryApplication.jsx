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
        name: 'webhookUrl',
        type: 'string',
        required: true,
        label: 'Webhook URL',
        placeholder: 'e.g. https://example.com/sentry/webhook/',
        help: 'The URL Sentry will send requests to on installation changes.',
      },
      {
        name: 'redirectUrl',
        type: 'string',
        label: 'Redirect URL',
        placeholder: 'e.g. https://example.com/sentry/setup/',
        help: 'The URL Sentry will redirect users to after installation.',
      },
      {
        name: 'overview',
        type: 'textarea',
        label: 'Overview',
        help: 'Description of your application and its functionality.',
      },
    ],
  },
];

export default forms;
