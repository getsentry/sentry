import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

/**
 * How a pill reads at a glance. Deliberately a small vocabulary of its own rather
 * than the web vitals module's `PerformanceScore`: the header now carries session
 * health as well as vital scores, and "needsImprovement" says nothing about a
 * session that errored.
 */
export type PillTone = 'good' | 'warning' | 'bad' | 'none';

/**
 * The tone palette, which matches `makePerformanceScoreColors` value for value.
 * Kept here rather than imported so a pill is not coupled to the web vitals
 * module, but kept identical so a `Score` pill and a `Health` pill beside it are
 * plainly the same kind of object.
 */
function toneColors(
  theme: Theme
): Record<PillTone, {bg: string; border: string; fg: string}> {
  return {
    good: {
      bg: theme.colors.gray100,
      fg: theme.tokens.content.success,
      border: theme.tokens.border.success.vibrant,
    },
    warning: {
      bg: theme.colors.yellow100,
      fg: theme.tokens.content.warning,
      border: theme.tokens.border.warning.vibrant,
    },
    bad: {
      bg: theme.colors.red100,
      fg: theme.tokens.content.danger,
      border: theme.tokens.border.danger.vibrant,
    },
    none: {
      bg: theme.colors.gray100,
      fg: theme.tokens.content.secondary,
      border: theme.tokens.border.secondary,
    },
  };
}

/**
 * One reading about the session, as a split pill: a toned name against a neutral
 * value. Borrowed from the trace view's context row, which is the other place in
 * the app that says "here is what this one thing measured".
 */
export function MetricPill({
  name,
  value,
  tone,
  tooltip,
  isLead,
}: {
  name: string;
  tone: PillTone;
  tooltip: React.ReactNode;
  value: string;
  /** Emphasises the value. A session's own verdict leads; the breakdown does not. */
  isLead?: boolean;
}) {
  return (
    <Pill>
      <PillName tone={tone}>
        <Tooltip title={tooltip}>{name}</Tooltip>
      </PillName>
      <PillValue isLead={isLead}>{value}</PillValue>
    </Pill>
  );
}

/**
 * The emboss the item count next to these carries, on the whole pill rather than
 * on either half: the two halves are one control, and a shadow under each would
 * draw the seam between them.
 */
const Pill = styled('div')`
  display: inline-flex;
  border-radius: ${p => p.theme.form.xs.borderRadius};
  box-shadow: 0 1px 0 0 ${p => p.theme.tokens.interactive.chonky.embossed.neutral.chonk};
`;

/**
 * Both halves are sized off `form.xs` rather than left to their line box. Every
 * other thing in the header row declares a height — the badge's avatar, the item
 * count's padding — so a pill that is only as tall as 12px of text renders a
 * third distinct height in a row that should have two.
 */
const PillName = styled('div')<{tone: PillTone}>`
  display: flex;
  align-items: center;
  justify-content: center;
  height: ${p => p.theme.form.xs.height};
  border: solid 1px ${p => toneColors(p.theme)[p.tone].border};
  border-radius: ${p => p.theme.form.xs.borderRadius} 0 0
    ${p => p.theme.form.xs.borderRadius};
  background-color: ${p => toneColors(p.theme)[p.tone].bg};
  color: ${p => toneColors(p.theme)[p.tone].fg};
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: ${p => p.theme.space['2xs']};
  text-decoration-thickness: 1px;
  padding: 0 ${p => p.theme.form.xs.paddingLeft}px;
  white-space: nowrap;
`;

const PillValue = styled('div')<{isLead?: boolean}>`
  display: flex;
  align-items: center;
  justify-content: center;
  height: ${p => p.theme.form.xs.height};
  /*
   * Floored rather than left to the content. The values are a duration, a two
   * decimal ratio and a bare score — "0.05" beside "340ms" beside "84" — and six
   * pills each shrink-wrapped to its own string reads as ragged rather than as a
   * set. Only a floor, so a value that needs the room still gets it.
   */
  min-width: 46px;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-left: none;
  border-radius: 0 ${p => p.theme.form.xs.borderRadius}
    ${p => p.theme.form.xs.borderRadius} 0;
  background: ${p => p.theme.tokens.background.primary};
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p =>
    p.isLead ? p.theme.font.weight.sans.medium : p.theme.font.weight.sans.regular};
  font-variant-numeric: tabular-nums;
  padding: 0 ${p => p.theme.form.xs.paddingLeft}px;
  white-space: nowrap;
`;
