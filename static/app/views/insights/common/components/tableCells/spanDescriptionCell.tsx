import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Hovercard} from 'sentry/components/hovercard';
import {t} from 'sentry/locale';
import {emptyStringValue, emptyValue} from 'sentry/utils/discover/emptyFieldValues';
import {SQLishFormatter} from 'sentry/utils/sqlish';
import {FullSpanDescription} from 'sentry/views/insights/common/components/fullSpanDescription';
import {SpanGroupDetailsLink} from 'sentry/views/insights/common/components/spanGroupDetailsLink';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';

const formatter = new SQLishFormatter();

const {SPAN_OP} = SpanFields;

interface Props {
  moduleName: ModuleName.DB | ModuleName.RESOURCE;
  projectId: number;
  description?: string;
  group?: string | null;
  spanOp?: string;
}

export function SpanDescriptionCell({
  description: rawDescription,
  group,
  moduleName,
  spanOp,
  projectId,
}: Props) {
  const formatterDescription = useMemo(() => {
    if (!rawDescription || moduleName !== ModuleName.DB) {
      return rawDescription;
    }

    return formatter.toSimpleMarkup(rawDescription);
  }, [moduleName, rawDescription]);

  if (!rawDescription) {
    return rawDescription === '' ? emptyStringValue : emptyValue;
  }

  const descriptionLink = (
    <SpanGroupDetailsLink
      moduleName={moduleName}
      group={group}
      projectId={projectId}
      spanOp={spanOp}
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
  margin-bottom: ${p => p.theme.space.md};
`;
