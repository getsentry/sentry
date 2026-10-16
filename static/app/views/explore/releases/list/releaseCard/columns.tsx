import styled from '@emotion/styled';

import {Container, type GridProps} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

export function getReleaseProjectColumns(
  showReleaseAdoptionStages: boolean
): NonNullable<GridProps['columns']> {
  const adoptionStagesSize = showReleaseAdoptionStages ? '0.7fr' : '';

  return {
    zero: '1fr 1.4fr 0.6fr 0.7fr',
    xl: '1fr 1fr 1fr 0.5fr 0.5fr 0.5fr',
    '5xl': `1fr ${adoptionStagesSize} 1fr 1fr 0.7fr 0.7fr 0.5fr`,
  };
}

export const ReleaseProjectColumn = styled(Container)`
  width: 100%;
  white-space: nowrap;
  text-overflow: ellipsis;
  line-height: 20px;
`;

export function NewIssuesColumn({children}: {children: React.ReactNode}) {
  return (
    <Text align={{zero: 'left', xl: 'right'}} tabular>
      {containerProps => (
        <ReleaseProjectColumn {...containerProps} overflow="hidden">
          {children}
        </ReleaseProjectColumn>
      )}
    </Text>
  );
}

const StyledAdoptionColumn = styled(ReleaseProjectColumn)`
  font-variant-numeric: tabular-nums;

  & > * {
    flex: 1;
  }
`;

export function AdoptionColumn({children}: {children: React.ReactNode}) {
  return (
    <StyledAdoptionColumn
      display={{zero: 'none', xl: 'flex'}}
      overflow={{zero: 'hidden', xl: 'visible'}}
    >
      {children}
    </StyledAdoptionColumn>
  );
}

const StyledAdoptionStageColumn = styled(ReleaseProjectColumn)`
  font-variant-numeric: tabular-nums;
`;

export function AdoptionStageColumn({children}: {children: React.ReactNode}) {
  return (
    <StyledAdoptionStageColumn
      display={{zero: 'none', '5xl': 'flex'}}
      overflow={{zero: 'hidden', '5xl': 'visible'}}
    >
      {children}
    </StyledAdoptionStageColumn>
  );
}

export function CrashFreeRateColumn({children}: {children: React.ReactNode}) {
  return (
    <Text align={{zero: 'left', xl: 'center', '5xl': 'right'}} tabular>
      {containerProps => (
        <ReleaseProjectColumn {...containerProps} overflow="hidden">
          {children}
        </ReleaseProjectColumn>
      )}
    </Text>
  );
}

export function DisplaySmallCol({children}: {children: React.ReactNode}) {
  return (
    <Text align="right" display={{zero: 'none', xl: 'block'}} tabular>
      {containerProps => (
        <ReleaseProjectColumn {...containerProps} overflow="hidden">
          {children}
        </ReleaseProjectColumn>
      )}
    </Text>
  );
}
