import React from 'react';
import styled from '@emotion/styled';

import {SentryAppIcon} from 'app/components/sentryAppIcon';
import {addQueryParamsToExistingUrl} from 'app/utils/queryString';
import space from 'app/styles/space';
import {t} from 'app/locale';
import {recordInteraction} from 'app/utils/recordSentryAppInteraction';
import ExternalLink from 'app/components/links/externalLink';
import {SentryAppComponent} from 'app/types';

type Props = {
  lineNo: number;
  filename: string;
  components: Array<SentryAppComponent>;
};

const OpenInContextLine = ({lineNo, filename, components}: Props) => {
  const handleRecordInteraction = (
    slug: SentryAppComponent['sentryApp']['slug']
  ) => () => {
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
            <SentryAppIcon slug={slug} />
            <OpenInName>{t(`${component.sentryApp.name}`)}</OpenInName>
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
  grid-gap: ${space(1)};
  color: ${p => p.theme.gray600};
  background-color: ${p => p.theme.white};
  font-family: ${p => p.theme.text.family};
  border-bottom: 1px solid ${p => p.theme.borderLight};
  padding: ${space(0.25)} ${space(3)};
  box-shadow: ${p => p.theme.dropShadowLightest};
  text-indent: initial;
  overflow: auto;
  white-space: nowrap;
`;

export const OpenInLink = styled(ExternalLink)`
  display: inline-grid;
  align-items: center;
  grid-template-columns: max-content auto;
  grid-gap: ${space(0.75)};
  color: ${p => p.theme.gray500};
`;

export const OpenInName = styled('strong')`
  color: ${p => p.theme.gray600};
  font-weight: 700;
`;
