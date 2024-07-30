import type {StepProps} from 'sentry/components/onboarding/gettingStartedDoc/step';

export function getProfilingDocumentHeaderConfigurationStep(): StepProps {
  return {
    title: 'Add Document-Policy: js-profiling header',
    description: `
For the JavaScript browser profiler to start, the document response header needs to include a Document-Policy header key with the js-profiling value.

How you do this will depend on how your assets are served. If you're using a server like Express, you'll be able to use the response.set('Document-Policy', 'js-profiling') function.
    `,
  };
}
