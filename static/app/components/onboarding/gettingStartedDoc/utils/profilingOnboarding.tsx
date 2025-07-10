import type React from 'react';
import {Fragment} from 'react';

import {
  type StepProps,
  TabbedCodeSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

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

export function MaybeBrowserProfilingBetaWarning(
  props: DocsParams<any>
): React.ReactElement | null {
  if (!props.isProfilingSelected) {
    return null;
  }

  return (
    <p>
      {tct(
        `Browser profiling is currently in Beta as we wait for the JS Self Profiling spec to gain wider support. You can read the detailed explanation [explainer].`,
        {
          explainer: (
            <a href="https://docs.sentry.io/platforms/javascript/profiling/">
              {t('here')}
            </a>
          ),
        }
      )}
    </p>
  );
}
