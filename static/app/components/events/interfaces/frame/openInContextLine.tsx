import {css, keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {hasStacktraceLinkInFrameFeature} from 'sentry/components/events/interfaces/frame/utils';
import ExternalLink from 'sentry/components/links/externalLink';
import SentryAppComponentIcon from 'sentry/components/sentryAppComponentIcon';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {SentryAppComponent, SentryAppSchemaStacktraceLink} from 'sentry/types';
import {addQueryParamsToExistingUrl} from 'sentry/utils/queryString';
import {recordInteraction} from 'sentry/utils/recordSentryAppInteraction';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  components: SentryAppComponent<SentryAppSchemaStacktraceLink>[];
  filename: string;
  lineNo: number | null;
};

function OpenInContextLine({lineNo, filename, components}: Props) {
  const organization = useOrganization({allowNull: true});
  const {user} = useLegacyStore(ConfigStore);
  const hasInFrameFeature = hasStacktraceLinkInFrameFeature(organization, user);

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
    <OpenInContainer
      columnQuantity={components.length + 1}
      hasInFrameFeature={hasInFrameFeature}
    >
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
            hasInFrameFeature={hasInFrameFeature}
          >
            <SentryAppComponentIcon sentryAppComponent={component} />
            <OpenInName hasInFrameFeature={hasInFrameFeature}>
              {component.sentryApp.name}
            </OpenInName>
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

const OpenInContainer = styled('div')<{
  columnQuantity: number;
  hasInFrameFeature: boolean;
}>`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  z-index: 1;
  font-family: ${p => p.theme.text.family};
  text-indent: initial;
  overflow: auto;
  white-space: nowrap;
  ${p =>
    p.hasInFrameFeature
      ? css`
          color: ${p.theme.linkColor};
          animation: ${fadeIn} 0.2s ease-in-out forwards;
          padding: ${space(0)};
        `
      : css`
          color: ${p.theme.subText};
          background-color: ${p.theme.background};
          border-bottom: 1px solid ${p.theme.border};
          padding: ${space(0.25)} ${space(3)};
          box-shadow: ${p.theme.dropShadowLight};
        `}
`;

const OpenInLink = styled(ExternalLink)<{hasInFrameFeature: boolean}>`
  display: flex;
  gap: ${space(0.75)};
  align-items: center;
  ${p => (p.hasInFrameFeature ? `` : `color: ${p.theme.gray300};`)}
`;

export const OpenInName = styled('span')<{hasInFrameFeature: boolean}>`
  ${p =>
    p.hasInFrameFeature
      ? css`
          &:hover {
            text-decoration: underline;
            text-decoration-color: ${p.theme.linkUnderline};
            text-underline-offset: ${space(0.5)};
          }
        `
      : ``}
`;
