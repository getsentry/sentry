import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import SentryAppComponentIcon from 'sentry/components/sentryAppComponentIcon';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {SentryAppComponent} from 'sentry/types';
import {addQueryParamsToExistingUrl} from 'sentry/utils/queryString';
import {recordInteraction} from 'sentry/utils/recordSentryAppInteraction';

type Props = {
  components: SentryAppComponent[];
  filename: string;
  lineNo: number;
};

const OpenInContextLine = ({lineNo, filename, components}: Props) => {
  const handleRecordInteraction =
    (slug: SentryAppComponent['sentryApp']['slug']) => () => {
      recordInteraction(slug, 'sentry_app_component_interacted', {
        componentType: 'stacktrace-link',
      });
    };

  const getUrl = (url: SentryAppComponent['schema']['url']) => {
    return addQueryParamsToExistingUrl(url, {lineNo, filename});
  };

  return (
    <OpenInContainer columnQuantity={components.length + 1}>
      <div>{t('Open this line in')}</div>
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
};

export {OpenInContextLine};

export const OpenInContainer = styled('div')<{columnQuantity: number}>`
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(${p => p.columnQuantity}, max-content);
  gap: ${space(1)};
  color: ${p => p.theme.subText};
  background-color: ${p => p.theme.background};
  font-family: ${p => p.theme.text.family};
  border-bottom: 1px solid ${p => p.theme.border};
  padding: ${space(0.25)} ${space(3)};
  box-shadow: ${p => p.theme.dropShadowLightest};
  text-indent: initial;
  overflow: auto;
  white-space: nowrap;
`;

const OpenInLink = styled(ExternalLink)`
  align-items: center;
  grid-template-columns: max-content auto;
  gap: ${space(0.75)};
  color: ${p => p.theme.gray300};
`;

export const OpenInName = styled('strong')`
  color: ${p => p.theme.subText};
  font-weight: 700;
`;
