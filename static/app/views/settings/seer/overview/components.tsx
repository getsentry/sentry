import {Fragment, type ReactNode} from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {FieldMeta} from '@sentry/scraps/form/field/meta';
import {useFieldContext} from '@sentry/scraps/form/formContext';
import {Container, Flex, Grid, Stack, type FlexProps} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';

export function SeerOverview({children}: {children: ReactNode}) {
  return (
    <Grid columns="minmax(140px, 50%) 1fr" gap="xl">
      {children}
    </Grid>
  );
}

function Section({children, isNew}: {children?: ReactNode; isNew?: boolean}) {
  if (isNew) {
    return (
      <Container radius="md" border="primary">
        {children}
      </Container>
    );
  }
  return (
    <Grid
      align="center"
      border="primary"
      column="1 / -1"
      columns="subgrid"
      gap="xl lg"
      padding="0 0 md 0"
      radius="md"
    >
      {children}
    </Grid>
  );
}

function SectionHeader({children, title}: {title: string; children?: ReactNode}) {
  return (
    <Flex
      align="baseline"
      background="secondary"
      borderBottom="primary"
      column="1 / -1"
      justify="between"
      padding="md xl"
      radius="md md 0 0"
    >
      <Heading as="h2" size="sm" density="compressed">
        <Text uppercase>{title}</Text>
      </Heading>
      {children}
    </Flex>
  );
}

function Stat({
  value,
  label,
  isPending,
}: {
  isPending: boolean;
  label: string;
  value: string | number;
}) {
  return (
    <Stack alignSelf="start" gap="md" padding="0 lg">
      <Text size="md" variant="muted">
        {label}
      </Text>
      {/* <Flex paddingLeft="md" justify="end" align="center" gap="md">
        {typeof value === 'string' ? value : <StatBar value={value} outOf={100} />}
      </Flex> */}
    </Stack>
  );
}

function StatBar({value, outOf}: {outOf: number; value: number}) {
  const percent = value / outOf;
  return (
    <div
      style={{
        width: '100px',
        height: '0.75em',
        display: 'flex',
        borderRadius: '0.25em',
      }}
    >
      <div
        style={{width: percent * 100 + '%', height: '100%', backgroundColor: 'blue'}}
      />
      <div
        style={{
          width: (1 - percent) * 100 + '%',
          height: '100%',
          backgroundColor: 'red',
        }}
      />
    </div>
  );
}

function ActionButton({children}: {children: ReactNode}) {
  return (
    <Flex alignSelf="start" align="center" justify="end" paddingRight="lg" gap="lg">
      {children}
    </Flex>
  );
}

function formatStatValue(value: number, outOf: number | undefined) {
  // return outOf === undefined ? value : `${value}\u2009/\u2009${outOf}`;

  return outOf === undefined ? 1.0 : value / outOf;
}

// const highlightFade = keyframes`
//   0% {
//     background-color: var(--highlight-color);
//   }
//   100% {
//     background-color: transparent;
//   }
// `;

// const HighlightableFlex = styled(Flex)`
//   --highlight-color: ${p => p.theme.tokens.background.transparent.accent.muted};

//   &[data-highlight] {
//     animation: ${highlightFade} ${p => p.theme.motion.smooth.slow};
//   }
// `;

// function RowLayout(props: {
//   children: React.ReactNode;
//   label: React.ReactNode;
//   hintText?: React.ReactNode;
//   padding?: FlexProps<'div'>['padding'];
//   required?: boolean;
//   variant?: 'compact';
// }) {
//   const isCompact = props.variant === 'compact';
//   const field = useFieldContext();

//   return (
//     <HighlightableFlex
//       id={field.name}
//       direction="row"
//       gap="xl"
//       align="center"
//       justify="between"
//       padding={props.padding}
//       flexGrow={1}
//     >
//       <Stack width="50%" gap="xs">
//         <Flex gap="xs" align="center">
//           <FieldMeta.Label
//             required={props.required}
//             description={isCompact ? props.hintText : undefined}
//           >
//             {props.label}
//           </FieldMeta.Label>
//         </Flex>
//         {props.hintText && !isCompact ? (
//           <FieldMeta.HintText>{props.hintText}</FieldMeta.HintText>
//         ) : null}
//       </Stack>

//       <Container flexGrow={1}>{props.children}</Container>
//     </HighlightableFlex>
//   );
// }

function Subtitle({children}: {children: ReactNode}) {
  return (
    <Flex column="1 / -1" padding="md lg">
      <Text>{children}</Text>
    </Flex>
  );
}

function Description({children}: {children: ReactNode}) {
  return (
    <Flex grow={1} alignSelf="start" padding="md lg">
      <Text size="sm" variant="muted">
        {children}
      </Text>
    </Flex>
  );
}

SeerOverview.Section = Section;
SeerOverview.SectionHeader = SectionHeader;
SeerOverview.Stat = Stat;
SeerOverview.StatBar = StatBar;
SeerOverview.ActionButton = ActionButton;
SeerOverview.formatStatValue = formatStatValue;
SeerOverview.Subtitle = Subtitle;
SeerOverview.Description = Description;
// SeerOverview.RowLayout = RowLayout;
