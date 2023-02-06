import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {KeyValueTableRow} from 'sentry/components/keyValueTable';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import Version from 'sentry/components/version';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {EventTag} from 'sentry/types/event';
import {isUrl} from 'sentry/utils';

interface Props {
  generateUrl: (tag: EventTag) => LocationDescriptor;
  query: string;
  tag: EventTag;
  meta?: Record<any, any>;
}

function TagsTableRow({tag, query, generateUrl, meta}: Props) {
  const tagInQuery = query.includes(`${tag.key}:`);
  const target = tagInQuery ? undefined : generateUrl(tag);
  const keyMetaData = meta?.key?.[''];
  const valueMetaData = meta?.value?.[''];

  const renderTagValue = () => {
    switch (tag.key) {
      case 'release':
        return <Version version={tag.value} anchor={false} withPackage />;
      default:
        return tag.value;
    }
  };
  return (
    <KeyValueTableRow
      keyName={
        !!keyMetaData && !tag.key ? (
          <AnnotatedText value={tag.key} meta={keyMetaData} />
        ) : (
          <StyledTooltip title={tag.key} showOnlyOnOverflow>
            {tag.key}
          </StyledTooltip>
        )
      }
      value={
        !!valueMetaData && !tag.value ? (
          <AnnotatedText value={tag.value} meta={valueMetaData} />
        ) : keyMetaData?.err?.length ? (
          <ValueContainer>{renderTagValue()}</ValueContainer>
        ) : tagInQuery ? (
          <StyledTooltip title={t('This tag is in the current filter conditions')}>
            <ValueContainer>{renderTagValue()}</ValueContainer>
          </StyledTooltip>
        ) : tag.key === 'url' ? (
          <ValueWithExtraContainer>
            <StyledTooltip title={renderTagValue()} showOnlyOnOverflow>
              <Link to={target || ''}>{renderTagValue()}</Link>
            </StyledTooltip>

            {isUrl(tag.value) && (
              <ExternalLink href={tag.value} className="external-icon">
                <IconOpen size="xs" />
              </ExternalLink>
            )}
          </ValueWithExtraContainer>
        ) : (
          <StyledTooltip title={renderTagValue()} showOnlyOnOverflow>
            <Link to={target || ''}>{renderTagValue()}</Link>
          </StyledTooltip>
        )
      }
    />
  );
}

export default TagsTableRow;

const StyledTooltip = styled(Tooltip)`
  ${p => p.theme.overflowEllipsis};
`;

const ValueContainer = styled('span')`
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: normal;
`;

const ValueWithExtraContainer = styled('span')`
  display: flex;
  align-items: center;
`;
