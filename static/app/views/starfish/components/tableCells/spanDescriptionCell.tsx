import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Hovercard} from 'sentry/components/hovercard';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {FullSpanDescription} from 'sentry/views/starfish/components/fullSpanDescription';
import {SpanDescriptionLink} from 'sentry/views/starfish/components/spanDescriptionLink';
import {ModuleName, SpanMetricsField} from 'sentry/views/starfish/types';
import {SQLishFormatter} from 'sentry/views/starfish/utils/sqlish/SQLishFormatter';

const formatter = new SQLishFormatter();

const {SPAN_OP} = SpanMetricsField;

interface Props {
  description: string;
  moduleName: ModuleName;
  projectId: number;
  endpoint?: string;
  endpointMethod?: string;
  group?: string;
  spanOp?: string;
}

export function SpanDescriptionCell({
  description: rawDescription,
  group,
  moduleName,
  spanOp,
  endpoint,
  endpointMethod,
  projectId,
}: Props) {
  const formatterDescription = useMemo(() => {
    if (moduleName !== ModuleName.DB) {
      return rawDescription;
    }

    return formatter.toSimpleMarkup(rawDescription);
  }, [moduleName, rawDescription]);

  if (!rawDescription) {
    return NULL_DESCRIPTION;
  }

  const descriptionLink = (
    <SpanDescriptionLink
      group={group}
      projectId={projectId}
      endpoint={endpoint}
      spanOp={spanOp}
      endpointMethod={endpointMethod}
      description={formatterDescription}
    />
  );

  if (moduleName === ModuleName.DB) {
    return (
      <WiderHovercard
        position="right"
        body={
          <FullSpanDescription
            group={group}
            shortDescription={rawDescription}
            language="sql"
          />
        }
      >
        {descriptionLink}
      </WiderHovercard>
    );
  }

  if (moduleName === ModuleName.HTTP) {
    return (
      <WiderHovercard
        position="right"
        body={
          <Fragment>
            <TitleWrapper>{t('Example')}</TitleWrapper>
            <FullSpanDescription
              group={group}
              shortDescription={rawDescription}
              language="http"
              filters={spanOp ? {[SPAN_OP]: spanOp} : undefined}
            />
          </Fragment>
        }
      >
        {descriptionLink}
      </WiderHovercard>
    );
  }

  return descriptionLink;
}

const NULL_DESCRIPTION = <span>&lt;null&gt;</span>;

export const WiderHovercard = styled(
  ({children, className, ...props}: React.ComponentProps<typeof Hovercard>) => (
    <Hovercard
      className={(className ?? '') + ' wider'}
      containerDisplayMode="inline-flex"
      {...props}
    >
      {children}
    </Hovercard>
  )
)`
  &.wider {
    width: auto;
    max-width: 550px;
  }
`;

const TitleWrapper = styled('div')`
  margin-bottom: ${space(1)};
`;
