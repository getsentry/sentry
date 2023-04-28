import {Fragment, ReactNode, useMemo} from 'react';
import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {KeyValueTableRow} from 'sentry/components/keyValueTable';
import Link from 'sentry/components/links/link';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import Version from 'sentry/components/version';

interface Props {
  name: string;
  values: ReactNode[];
  generateUrl?: (name: string, value: ReactNode) => LocationDescriptor;
}

function ReplayTagsTableRow({name, values, generateUrl}: Props) {
  const renderTagValue = useMemo(() => {
    if (name === 'release') {
      return values.map((value, index) => (
        <Fragment key={`${name}-${index}-${value}`}>
          {index > 0 && ', '}
          <Version key={index} version={String(value)} anchor={false} withPackage />
        </Fragment>
      ));
    }

    return values.map((value, index) => {
      const target = generateUrl?.(name, value);

      return (
        <Fragment key={`${name}-${index}-${value}`}>
          {index > 0 && ', '}
          {target ? <Link to={target}>{value}</Link> : <AnnotatedText value={value} />}
        </Fragment>
      );
    });
  }, [name, values, generateUrl]);

  return (
    <KeyValueTableRow
      keyName={
        <KeyTooltip title={name} showOnlyOnOverflow>
          {name}
        </KeyTooltip>
      }
      value={
        <ValueTooltip title={renderTagValue} isHoverable showOnlyOnOverflow>
          <TextOverflow ellipsisDirection="left">{renderTagValue}</TextOverflow>
        </ValueTooltip>
      }
    />
  );
}

export default ReplayTagsTableRow;

const KeyTooltip = styled(Tooltip)`
  ${p => p.theme.overflowEllipsis};
`;

const ValueTooltip = styled(Tooltip)`
  display: flex;
  justify-content: flex-end;
`;
