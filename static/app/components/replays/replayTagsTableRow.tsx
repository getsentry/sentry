import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {type LocationDescriptor} from 'history';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {KeyValueTableRow} from 'sentry/components/keyValueTable';
import Link from 'sentry/components/links/link';
import Tooltip from 'sentry/components/tooltip';
import Version from 'sentry/components/version';
import {type EventTag} from 'sentry/types/event';

type Tag = {key: string; value: string[]};

interface Props {
  tag: Tag;
  generateUrl?: (tag: EventTag) => LocationDescriptor;
  query?: string;
}

function ReplayTagsTableRow({tag, query, generateUrl}: Props) {
  const renderTagValue = useMemo(() => {
    if (tag.key === 'release') {
      return tag.value.map((value, index) => {
        return (
          <Fragment key={value}>
            {index > 0 && ', '}
            <Version key={index} version={value} anchor={false} withPackage />
          </Fragment>
        );
      });
    }

    return tag.value.map((value, index) => {
      const valueInQuery = query?.includes(`${tag.key}:${value}`);
      const target = valueInQuery ? undefined : generateUrl?.({key: tag.key, value});

      return (
        <Fragment key={value}>
          {index > 0 && ', '}
          {target ? <Link to={target}>{value}</Link> : <AnnotatedText value={value} />}
        </Fragment>
      );
    });
  }, [tag, query, generateUrl]);

  return (
    <KeyValueTableRow
      keyName={
        <StyledTooltip title={tag.key} showOnlyOnOverflow>
          {tag.key}
        </StyledTooltip>
      }
      value={
        <StyledTooltip title={renderTagValue} isHoverable showOnlyOnOverflow>
          {renderTagValue}
        </StyledTooltip>
      }
    />
  );
}

export default ReplayTagsTableRow;

const StyledTooltip = styled(Tooltip)`
  ${p => p.theme.overflowEllipsis};
`;
