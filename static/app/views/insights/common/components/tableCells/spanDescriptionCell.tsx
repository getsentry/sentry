import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Hovercard} from 'sentry/components/hovercard';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {SQLishFormatter} from 'sentry/utils/sqlish/SQLishFormatter';
import {FullSpanDescription} from 'sentry/views/insights/common/components/fullSpanDescription';
import {SpanGroupDetailsLink} from 'sentry/views/insights/common/components/spanGroupDetailsLink';
import {SupportedDatabaseSystem} from 'sentry/views/insights/database/utils/constants';
import {formatMongoDBQuery} from 'sentry/views/insights/database/utils/formatMongoDBQuery';
import {ModuleName, SpanMetricsField} from 'sentry/views/insights/types';

const formatter = new SQLishFormatter();

const {SPAN_OP} = SpanMetricsField;

interface Props {
  description: string;
  moduleName: ModuleName.DB | ModuleName.RESOURCE;
  projectId: number;
  extraLinkQueryParams?: Record<string, string>;
  group?: string;
  spanAction?: string;
  spanOp?: string;
  system?: string;
}

export function SpanDescriptionCell({
  description: rawDescription,
  group,
  moduleName,
  spanOp,
  projectId,
  system,
  spanAction,
  extraLinkQueryParams,
}: Props) {
  const formatterDescription = useMemo(() => {
    if (moduleName !== ModuleName.DB) {
      return rawDescription;
    }

    if (system === SupportedDatabaseSystem.MONGODB) {
      return spanAction ? formatMongoDBQuery(rawDescription, spanAction) : rawDescription;
    }

    return formatter.toSimpleMarkup(rawDescription);
  }, [moduleName, rawDescription, spanAction, system]);

  if (!rawDescription) {
    return NULL_DESCRIPTION;
  }

  const descriptionLink = (
    <SpanGroupDetailsLink
      moduleName={moduleName}
      group={group}
      projectId={projectId}
      spanOp={spanOp}
      description={formatterDescription}
      extraLinkQueryParams={extraLinkQueryParams}
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
            moduleName={moduleName}
          />
        }
      >
        {descriptionLink}
      </WiderHovercard>
    );
  }

  if (moduleName === ModuleName.RESOURCE) {
    return (
      <WiderHovercard
        position="right"
        body={
          <Fragment>
            <TitleWrapper>{t('Example')}</TitleWrapper>
            <FullSpanDescription
              group={group}
              shortDescription={rawDescription}
              moduleName={moduleName}
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
