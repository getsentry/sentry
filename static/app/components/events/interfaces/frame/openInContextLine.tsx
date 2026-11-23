import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {ExternalLink} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {SentryAppComponentIcon} from 'sentry/components/sentryAppComponentIcon';
import type {
  SentryAppComponent,
  SentryAppSchemaStacktraceLink,
} from 'sentry/types/integrations';
import {addQueryParamsToExistingUrl} from 'sentry/utils/queryString';

type Props = {
  components: Array<SentryAppComponent<SentryAppSchemaStacktraceLink>>;
  filename: string;
  lineNo: number | null;
};

function OpenInContextLine({lineNo, filename, components}: Props) {
  const getUrl = (url: SentryAppSchemaStacktraceLink['url']) => {
    return addQueryParamsToExistingUrl(url, {lineNo, filename});
  };

  return (
    <OpenInContainer>
      {components.map(component => {
        const url = getUrl(component.schema.url);
        return (
          <Tooltip key={component.uuid} title={component.sentryApp.name} skipWrapper>
            <OpenInLink aria-label={component.sentryApp.name} href={url} openInNewTab>
              <SentryAppComponentIcon sentryAppComponent={component} size={16} />
            </OpenInLink>
          </Tooltip>
        );
      })}
    </OpenInContainer>
  );
}

export {OpenInContextLine};

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const OpenInContainer = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.md};
  align-items: center;
  z-index: 1;
  font-family: ${p => p.theme.font.family.sans};
  text-indent: initial;
  overflow: auto;
  white-space: nowrap;
  animation: ${fadeIn} 0.2s ease-in-out forwards;
`;

const OpenInLink = styled(ExternalLink)`
  display: flex;
  gap: ${p => p.theme.space.sm};
  align-items: center;
  color: ${p => p.theme.tokens.content.secondary};
`;
