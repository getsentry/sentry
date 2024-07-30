import {Fragment} from 'react';

import {
  type StepProps,
  TabbedCodeSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {tct} from 'sentry/locale';

export function getProfilingDocumentHeaderConfigurationStep(): StepProps {
  return {
    title: 'Add Document-Policy: js-profiling header',
    description: (
      <Fragment>
        <p>
          {tct(
            `For the JavaScript browser profiler to start, the document response header needs
          to include a Document-Policy header key with the js-profiling value. How you do
          this will depend on how your assets are served.

          If you're using a server like Express, you'll be able to use the response.set function to set the header value.
          `,
            {}
          )}
        </p>
        <TabbedCodeSnippet
          tabs={[
            {
              code: `response.set('Document-Policy', 'js-profiling')`,
              language: 'javascript',
              value: 'javascript',
              label: 'Express',
            },
          ]}
        />
      </Fragment>
    ),
  };
}
