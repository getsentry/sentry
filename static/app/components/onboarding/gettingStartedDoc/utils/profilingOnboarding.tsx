import type React from 'react';
import {Fragment} from 'react';

import {
  type StepProps,
  TabbedCodeSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/step';
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

export function BrowserProfilingBetaWarning(): React.ReactElement {
  return (
    <Fragment>
      <p>
        {tct(
          `Our browser profiling integration is built on top of the profiler exposed by the [selfProfilingApi], it's in beta and will likely only move out once the official spec progresses and gains adoption. As with any beta package, there are risks involved in using it - see [platformStatus].`,
          {
            selfProfilingApi: (
              <a href="https://wicg.github.io/js-self-profiling/">
                {t('JS Self Profiling API')}
              </a>
            ),
            platformStatus: (
              <a href="https://chromestatus.com/feature/5170190448852992">
                {t('platform status')}
              </a>
            ),
          }
        )}
      </p>
      <p>
        {tct(
          `Please note, that since profiling API is currently only implemented in Chromium based browsers, the profiles collected will inherently be biased towards that demographic. This is something you'll need to consider if you're basing your decisions on the data collected. We hope that as the API gains adoption, other browsers will implement it as well. If you find browser profiling feature helpful and would like to see it gain further adoption, please consider supporting the spec at the official [wicgRepository].`,
          {
            wicgRepository: (
              <a href="https://github.com/WICG/js-self-profiling">
                {t('WICG repository')}
              </a>
            ),
          }
        )}
      </p>

      <p>
        {t(
          `Install our JavaScript browser SDK using either yarn or npm, the minimum version that supports profiling is 7.60.0.`
        )}
      </p>
    </Fragment>
  );
}
