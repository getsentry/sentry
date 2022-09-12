import React, {ReactElement} from 'react';
import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';

import {KeyValueTableRow} from 'sentry/components/keyValueTable';
import Link from 'sentry/components/links/link';
import Tooltip from 'sentry/components/tooltip';
import Version from 'sentry/components/version';
import {EventTag} from 'sentry/types/event';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';

type Tag = {key: string; value: string[]};

interface Props {
  generateUrl: (tag: EventTag) => LocationDescriptor;
  query: string;
  tag: Tag;
  meta?: Record<any, any>;
}

function ReplayTagsTableRow({tag, query, generateUrl, meta}: Props) {
  const keyMetaData = meta?.key?.[''];
  const valueMetaData = meta?.value?.[''];

  const renderTagValue = () => {
    switch (tag.key) {
      case 'release': {
        return tag.value.reduce((acc, value, index) => {
          acc.push(<Version key={value} anchor={false} version={value} withPackage />);
          if (index !== tag.value.length - 1) {
            acc.push(', ');
          }
          return acc;
        }, [] as (ReactElement | string)[]);
      }
      default: {
        return tag.value.map((value, index) => {
          const valueInQuery = query.includes(`${tag.key}:${value}`);
          const target = valueInQuery ? undefined : generateUrl({key: tag.key, value});

          return (
            <React.Fragment key={value}>
              {index > 0 && ', '}
              {target ? (
                <Link to={target} data-test-id="tag-value">
                  {value}
                </Link>
              ) : (
                <AnnotatedText value={value} meta={valueMetaData} />
              )}
            </React.Fragment>
          );
        });
      }
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
        <StyledTooltip title={renderTagValue()} isHoverable showOnlyOnOverflow>
          {renderTagValue()}
        </StyledTooltip>
      }
    />
  );
}

export default ReplayTagsTableRow;

const StyledTooltip = styled(Tooltip)`
  ${p => p.theme.overflowEllipsis};
`;
