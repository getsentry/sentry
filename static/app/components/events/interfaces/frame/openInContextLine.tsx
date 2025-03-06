import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import SentryAppComponentIcon from 'sentry/components/sentryAppComponentIcon';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import type {
  SentryAppComponent,
  SentryAppSchemaStacktraceLink,
} from 'sentry/types/integrations';
import {addQueryParamsToExistingUrl} from 'sentry/utils/queryString';
import {recordInteraction} from 'sentry/utils/recordSentryAppInteraction';

type Props = {
  components: Array<SentryAppComponent<SentryAppSchemaStacktraceLink>>;
  filename: string;
  lineNo: number | null;
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
    <OpenInContainer>
      {components.map(component => {
        const url = getUrl(component.schema.url);
        const {slug} = component.sentryApp;
        const onClickRecordInteraction = handleRecordInteraction(slug);
        return (
          <Tooltip key={component.uuid} title={component.sentryApp.name} skipWrapper>
            <OpenInLink
              aria-label={component.sentryApp.name}
              href={url}
              onClick={onClickRecordInteraction}
              onContextMenu={onClickRecordInteraction}
              openInNewTab
            >
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
  gap: ${space(1)};
  align-items: center;
  z-index: 1;
  font-family: ${p => p.theme.text.family};
  text-indent: initial;
  overflow: auto;
  white-space: nowrap;
  animation: ${fadeIn} 0.2s ease-in-out forwards;
`;

const OpenInLink = styled(ExternalLink)`
  display: flex;
  gap: ${space(0.75)};
  align-items: center;
  color: ${p => p.theme.gray300};
`;
