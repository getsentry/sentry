import React from 'react';
import {tct} from 'app/locale';

const forms = [
  {
    // Form "section"/"panel"
    title: 'Integration Details',
    fields: [
      {
        name: 'internal',
        label: 'Internal',
        type: 'boolean',
        help: 'Choose this to make your integration Internal.',
      },
      {
        name: 'name',
        type: 'string',
        required: true,
        placeholder: 'e.g. My Integration',
        label: 'Name',
        help: 'Human readable name of your Integration.',
      },
      {
        name: 'author',
        type: 'string',
        required: true,
        placeholder: 'Acme Software',
        label: 'Author',
        help: 'The company or person who built and maintains this Integration.',
      },
      {
        name: 'webhookUrl',
        type: 'string',
        required: true,
        label: 'Webhook URL',
        placeholder: 'e.g. https://example.com/sentry/webhook/',
        help:
          'The URL Sentry will send requests to for events such as installation changes and any Resource Subscriptions the Integration subscribes to.',
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
        name: 'schema',
        type: 'textarea',
        label: 'Schema',
        autosize: true,
        help: 'Schema for your UI components',
        getValue: val => {
          return val == '' ? {} : JSON.parse(val);
        },
        setValue: val => {
          const schema = JSON.stringify(val, null, 2);
          if (schema == '{}') {
            return '';
          }
          return schema;
        },
        validate: ({id, form}) => {
          if (!form.schema) {
            return [];
          }

          try {
            JSON.parse(form.schema);
          } catch (e) {
            return [[id, 'Invalid JSON']];
          }
          return [];
        },
      },
      {
        name: 'overview',
        type: 'textarea',
        label: 'Overview',
        autosize: true,
        help: 'Description of your Integration and its functionality.',
      },
    ],
  },
];

export default forms;
