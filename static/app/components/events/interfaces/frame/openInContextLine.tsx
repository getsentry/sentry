import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import SentryAppComponentIcon from 'sentry/components/sentryAppComponentIcon';
import {space} from 'sentry/styles/space';
import {SentryAppComponent, SentryAppSchemaStacktraceLink} from 'sentry/types';
import {addQueryParamsToExistingUrl} from 'sentry/utils/queryString';
import {recordInteraction} from 'sentry/utils/recordSentryAppInteraction';

type Props = {
  components: SentryAppComponent<SentryAppSchemaStacktraceLink>[];
  filename: string;
  lineNo: number;
};

function OpenInContextLine({lineNo, filename, components}: Props) {
  const handleRecordInteraction =
    (slug: SentryAppComponent<SentryAppSchemaStacktraceLink>['sentryApp']['slug']) =>
    () => {
      recordInteraction(slug, 'sentry_app_component_interacted', {
        componentType: 'stacktrace-link',
      });
    };

  const getUrl = (url: SentryAppSchemaStacktraceLink['url']) => {
    return addQueryParamsToExistingUrl(url, {lineNo, filename});
  };

  return (
    <OpenInContainer columnQuantity={components.length + 1}>
      {components.map(component => {
        const url = getUrl(component.schema.url);
        const {slug} = component.sentryApp;
        const onClickRecordInteraction = handleRecordInteraction(slug);
        return (
          <OpenInLink
            key={component.uuid}
            data-test-id={`stacktrace-link-${slug}`}
            href={url}
            onClick={onClickRecordInteraction}
            onContextMenu={onClickRecordInteraction}
            openInNewTab
          >
            <SentryAppComponentIcon sentryAppComponent={component} />
            <OpenInName>{component.sentryApp.name}</OpenInName>
          </OpenInLink>
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

const OpenInContainer = styled('div')<{columnQuantity: number}>`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  z-index: 1;
  color: ${p => p.theme.linkColor};
  font-family: ${p => p.theme.text.family};
  padding: ${space(0)} ${space(0)};
  text-indent: initial;
  overflow: auto;
  white-space: nowrap;
  animation: ${fadeIn} 0.2s ease-in-out forwards;
`;

const OpenInLink = styled(ExternalLink)`
  display: flex;
  gap: ${space(0.75)};
  align-items: center;
`;

export const OpenInName = styled('span')`
  &:hover {
    text-decoration: underline;
    text-decoration-color: ${p => p.theme.linkUnderline};
    text-underline-offset: ${space(0.5)};
  }
`;
