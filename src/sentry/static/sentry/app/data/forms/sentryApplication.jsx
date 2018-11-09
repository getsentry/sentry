import React from 'react';
import {tct} from 'app/locale';

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
        name: 'isAlertable',
        type: 'boolean',
        label: 'Alert Rule Action',
        help: tct(
          'If enabled, this application will be an action under alert rules in Sentry. The notification destination is the Webhook URL specified above. More on actions [learn_more:Here].',
          {
            learn_more: (
              <a href="https://docs.sentry.io/product/notifications/#actions" />
            ),
          }
        ),
      },
      {
        name: 'overview',
        type: 'textarea',
        label: 'Overview',
        autosize: true,
        help: 'Description of your application and its functionality.',
      },
    ],
  },
];

export default forms;
