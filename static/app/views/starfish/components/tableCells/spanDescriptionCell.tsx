import styled from '@emotion/styled';

import {Hovercard} from 'sentry/components/hovercard';
import {FullQueryDescription} from 'sentry/views/starfish/components/fullQueryDescription';
import {SpanDescriptionLink} from 'sentry/views/starfish/components/spanDescriptionLink';
import {ModuleName} from 'sentry/views/starfish/types';
import {SQLishFormatter} from 'sentry/views/starfish/utils/sqlish/SQLishFormatter';

const formatter = new SQLishFormatter();

interface Props {
  moduleName: ModuleName;
  projectId: number;
  description?: string;
  endpoint?: string;
  endpointMethod?: string;
  group?: string;
}

export function SpanDescriptionCell({
  description,
  group,
  moduleName,
  endpoint,
  endpointMethod,
  projectId,
}: Props) {
  if (!description) {
    return NULL_DESCRIPTION;
  }

  const descriptionLink = (
    <SpanDescriptionLink
      group={group}
      projectId={projectId}
      endpoint={endpoint}
      endpointMethod={endpointMethod}
      description={
        moduleName === ModuleName.DB ? formatter.toSimpleMarkup(description) : description
      }
    />
  );

  return ModuleName.DB ? (
    <DescriptionWrapper>
      <WiderHovercard
        position="right"
        body={<FullQueryDescription group={group} shortDescription={description} />}
      >
        {descriptionLink}
      </WiderHovercard>
    </DescriptionWrapper>
  ) : (
    descriptionLink
  );
}

const NULL_DESCRIPTION = <span>&lt;null&gt;</span>;

export const WiderHovercard = styled(
  ({
    children,
    className,
    containerClassName,
    ...props
  }: React.ComponentProps<typeof Hovercard>) => (
    <Hovercard
      className={(className ?? '') + ' wider'}
      containerClassName={(containerClassName ?? '') + ' inline-flex'}
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

const DescriptionWrapper = styled('div')`
  .inline-flex {
    display: inline-flex;
  }
`;
