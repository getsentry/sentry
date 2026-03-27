import {type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {ExternalLink} from 'sentry/components/links/externalLink';
import {StructuredEventData} from 'sentry/components/structuredEventData';
import {type RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import {isUrl} from 'sentry/utils/string/isUrl';
import {AnnotatedAttributeTooltip} from 'sentry/views/explore/components/annotatedAttributeTooltip';
import {getAttributeItem} from 'sentry/views/explore/components/traceItemAttributes/utils';
import {TraceItemMetaInfo} from 'sentry/views/explore/utils';
import {tryParseJson} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';

import type {
  AttributesFieldRender,
  AttributesTreeContent,
  AttributesTreeRowConfig,
} from './attributesTree';

export function AttributesTreeValue<RendererExtra extends RenderFunctionBaggage>({
  config,
  content,
  renderers = {},
  rendererExtra: renderExtra,
}: {
  content: AttributesTreeContent;
  config?: AttributesTreeRowConfig;
} & AttributesFieldRender<RendererExtra> & {theme: Theme}) {
  const {originalAttribute} = content;
  if (!originalAttribute) {
    return null;
  }

  // Check if we have a custom renderer for this attribute
  const attributeKey = originalAttribute.original_attribute_key;
  const renderer = renderers[attributeKey];
  const value = String(content.value);

  const defaultValue = <span>{value}</span>;

  if (config?.disableRichValue) {
    return value;
  }

  if (renderer) {
    return renderer({
      item: getAttributeItem(attributeKey, content.value),
      basicRendered: defaultValue,
      extra: renderExtra,
    });
  }

  if (renderExtra.traceItemMeta) {
    const metaInfo = new TraceItemMetaInfo(renderExtra.traceItemMeta);
    if (metaInfo.hasRemarks(attributeKey)) {
      return (
        <AnnotatedAttributeTooltip fieldKey={attributeKey} extra={renderExtra}>
          {defaultValue}
        </AnnotatedAttributeTooltip>
      );
    }
  }
  const parsedJson = tryParseJson(content.value);
  if (typeof parsedJson === 'object' && parsedJson !== null) {
    return (
      <AttributeStructuredData
        data={parsedJson}
        maxDefaultDepth={2}
        withAnnotatedText={false}
        className={value.length <= 48 ? 'compact' : undefined}
      />
    );
  }

  return isUrl(value) ? (
    <AttributeLinkText>
      <ExternalLink
        onClick={e => {
          e.preventDefault();
          openNavigateToExternalLinkModal({linkText: value});
        }}
      >
        {defaultValue}
      </ExternalLink>
    </AttributeLinkText>
  ) : (
    defaultValue
  );
}

const AttributeLinkText = styled('span')`
  color: ${p => p.theme.tokens.interactive.link.accent.rest};
  text-decoration: ${p => p.theme.tokens.interactive.link.accent.rest} underline dotted;
  margin: 0;
  &:hover,
  &:focus {
    text-decoration: none;
  }

  div {
    white-space: normal;
  }
`;

const AttributeStructuredData = styled(StructuredEventData)`
  margin: 0;
  padding: 0;
  background: transparent;
  white-space: pre-wrap;
  word-break: break-word;

  &.compact {
    display: inline;

    span[data-base-with-toggle='true'] {
      display: inline;
      padding-left: 0;
    }

    button {
      display: none;
    }

    div {
      display: inline;
      padding-left: 0;
    }
  }
`;
