import styled from '@emotion/styled';

import type {ContentBlock} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/types';
import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {TextCopyInput} from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';

function CopyDsnField({params}: {params: DocsParams<any>}) {
  return (
    <Wrapper>
      <p>
        {tct(
          "If you already have the configuration for Sentry in your application, and just need this project's ([projectSlug]) DSN, you can find it below:",
          {
            projectSlug: <code>{params.project.slug}</code>,
          }
        )}
      </p>
      <TextCopyInput
        onCopy={() =>
          trackAnalytics('onboarding.dsn-copied', {
            organization: params.organization,
            platform: params.platformKey,
          })
        }
      >
        {params.dsn.public}
      </TextCopyInput>
    </Wrapper>
  );
}

/**
 * Returns a `custom` content block for `CopyDsnField` with a `markdown`
 * representation so the DSN is included in copied markdown output.
 */
export function copyDsnFieldBlock(params: DocsParams<any>): ContentBlock {
  return {
    type: 'custom',
    content: <CopyDsnField params={params} />,
    markdown: [
      t(
        "If you already have the configuration for Sentry in your application, and just need this project's (%s) DSN, you can find it below:",
        params.project.slug
      ),
      `\`\`\`\n${params.dsn.public}\n\`\`\``,
    ].join('\n\n'),
  };
}

const Wrapper = styled('div')`
  padding-top: ${p => p.theme.space.xl};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
`;
