import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';
import capitalize from 'lodash/capitalize';

import {SectionHeading} from 'sentry/components/charts/styles';
import {getMeta, withMeta} from 'sentry/components/events/meta/metaProxy';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import Link from 'sentry/components/links/link';
import Tooltip from 'sentry/components/tooltip';
import Version from 'sentry/components/version';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {MetaError} from 'sentry/types';
import {Event, EventTag} from 'sentry/types/event';

type Props = {
  event: Event;
  generateUrl: (tag: EventTag) => LocationDescriptor;
  query: string;
  title?: React.ReactNode;
};

const TagsTable = ({event, query, generateUrl, title = t('Tag Details')}: Props) => {
  const eventWithMeta = withMeta(event) as Event;
  const tags = eventWithMeta.tags;

  const formatErrorKind = (kind: string) => {
    return capitalize(kind.replace(/_/g, ' '));
  };

  const getErrorMessage = (error: MetaError) => {
    if (Array.isArray(error)) {
      if (error[1]?.reason) {
        return formatErrorKind(error[1].reason);
      }
      return formatErrorKind(error[0]);
    }
    return formatErrorKind(error);
  };

  const getTooltipTitle = (errors: Array<MetaError>) => {
    return <TooltipTitle>{getErrorMessage(errors[0])}</TooltipTitle>;
  };

  return (
    <StyledTagsTable>
      <SectionHeading>{title}</SectionHeading>
      <KeyValueTable>
        {tags.map(tag => {
          const tagInQuery = query.includes(`${tag.key}:`);
          const target = tagInQuery ? undefined : generateUrl(tag);
          const keyMetaData = getMeta(tag, 'key');
          const valueMetaData = getMeta(tag, 'value');

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
              key={tag.key}
              keyName={
                keyMetaData?.err?.length ? (
                  <Tooltip title={getTooltipTitle(keyMetaData.err)}>
                    <i>{`<${t('invalid')}>`}</i>
                  </Tooltip>
                ) : (
                  <StyledTooltip title={tag.key}>{tag.key}</StyledTooltip>
                )
              }
              value={
                valueMetaData?.err?.length ? (
                  <Tooltip title={getTooltipTitle(valueMetaData.err)}>
                    <i>{`<${t('invalid')}>`}</i>
                  </Tooltip>
                ) : keyMetaData?.err?.length ? (
                  <span>{renderTagValue()}</span>
                ) : tagInQuery ? (
                  <Tooltip title={t('This tag is in the current filter conditions')}>
                    <span>{renderTagValue()}</span>
                  </Tooltip>
                ) : (
                  <StyledTooltip title={renderTagValue()}>
                    <Link to={target || ''}>{renderTagValue()}</Link>
                  </StyledTooltip>
                )
              }
            />
          );
        })}
      </KeyValueTable>
    </StyledTagsTable>
  );
};

export default TagsTable;

const StyledTooltip = styled(Tooltip)`
  ${p => p.theme.overflowEllipsis};
`;

const StyledTagsTable = styled('div')`
  margin-bottom: ${space(3)};
`;

const TooltipTitle = styled('div')`
  text-align: left;
`;
