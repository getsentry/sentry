import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {KeyValueTableRow} from 'sentry/components/keyValueTable';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import Version from 'sentry/components/version';

interface Props {
  name: string;
  values: string[];
  generateUrl?: (name: string, value: string) => LocationDescriptor;
}

const ReplayTagsTableRow = ({name, values, generateUrl}: Props) => {
  const renderTagValue = useMemo(() => {
    if (name === 'release') {
      return values.map((value, index) => {
        return (
          <Fragment key={value}>
            {index > 0 && ', '}
            <Version key={index} version={value} anchor={false} withPackage />
          </Fragment>
        );
      });
    }

    return values.map((value, index) => {
      const target = generateUrl?.(name, value);

      return (
        <Fragment key={value}>
          {index > 0 && ', '}
          {target ? <Link to={target}>{value}</Link> : <AnnotatedText value={value} />}
        </Fragment>
      );
    });
  }, [name, values, generateUrl]);

  return (
    <KeyValueTableRow
      keyName={
        <StyledTooltip title={name} showOnlyOnOverflow>
          {name}
        </StyledTooltip>
      }
      value={
        <StyledTooltip title={renderTagValue} isHoverable showOnlyOnOverflow>
          {renderTagValue}
        </StyledTooltip>
      }
    />
  );
};

export default ReplayTagsTableRow;

const StyledTooltip = styled(Tooltip)`
  ${p => p.theme.overflowEllipsis};
`;
