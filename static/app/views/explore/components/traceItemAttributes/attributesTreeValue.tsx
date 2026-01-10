import {type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import ExternalLink from 'sentry/components/links/externalLink';
import {type RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import {isUrl} from 'sentry/utils/string/isUrl';
import {AnnotatedAttributeTooltip} from 'sentry/views/explore/components/annotatedAttributeTooltip';
import {getAttributeItem} from 'sentry/views/explore/components/traceItemAttributes/utils';
import {TraceItemMetaInfo} from 'sentry/views/explore/utils';

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

  const defaultValue = <span>{String(content.value)}</span>;

  if (config?.disableRichValue) {
    return String(content.value);
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
  return isUrl(String(content.value)) ? (
    <AttributeLinkText>
      <ExternalLink
        onClick={e => {
          e.preventDefault();
          openNavigateToExternalLinkModal({linkText: String(content.value)});
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
