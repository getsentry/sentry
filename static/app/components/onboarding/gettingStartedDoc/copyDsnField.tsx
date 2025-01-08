import styled from '@emotion/styled';

import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import TextCopyInput from 'sentry/components/textCopyInput';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';

export function CopyDsnField({params}: {params: DocsParams<any>}) {
  return (
    <Wrapper>
      <p>
        {tct(
          "If you already have the configuration for Sentry in your application, and just need this project's ([projectSlug]) DSN, you can find it below:",
          {
            projectSlug: <code>{params.projectSlug}</code>,
          }
        )}
      </p>
      <TextCopyInput
        onCopy={() =>
          trackAnalytics('onboarding.nextjs-dsn-copied', {
            organization: params.organization,
          })
        }
      >
        {params.dsn.public}
      </TextCopyInput>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  padding-top: ${space(2)};
  border-top: 1px solid ${p => p.theme.border};
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;
