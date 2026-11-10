import type {Theme} from '@emotion/react';

import {defaultFormatAxisLabel} from 'sentry/components/charts/components/tooltip';
import {t} from 'sentry/locale';
import type {IncidentPeriod} from 'sentry/views/detectors/hooks/useIncidentMarkers';

interface IncidentTooltipContext {
  period: IncidentPeriod;
  theme: Theme;
}

function formatTimestamp(timestamp: number) {
  return defaultFormatAxisLabel(timestamp, true, false, true, false).toString();
}

function formatTimeRange(start: number, end: number) {
  return defaultFormatAxisLabel(start, true, false, true, false, end - start).toString();
}

function getIncidentPeriodTitle(period: IncidentPeriod) {
  return period.type === 'trigger-interval' ? t('Threshold breached') : t('Issue open');
}

function titleRow(title: string) {
  return `<div><span class="tooltip-label"><strong>${title}</strong></span></div>`;
}

function labeledRow(label: string, value: string) {
  return `<div><span class="tooltip-label">${label}</span> ${value}</div>`;
}

function priorityRow({period, theme}: IncidentTooltipContext) {
  const color = period.priority === 'high' ? theme.colors.red400 : theme.colors.yellow400;

  const priorityLabel = period.priority === 'high' ? t('High') : t('Medium');

  const priorityDot = `<span style="display:inline-block;width:10px;height:8px;border-radius:100%;background:${color};margin-right:6px;vertical-align:middle;"></span>`;

  return labeledRow(t('Priority'), `${priorityDot} ${priorityLabel}`);
}

function incidentPeriodTimeRows(period: IncidentPeriod) {
  if (period.type === 'trigger-interval') {
    return labeledRow(t('Interval'), formatTimeRange(period.start, period.end));
  }

  const endTime = period.isOngoing ? t('Ongoing') : formatTimestamp(period.end);

  return [
    labeledRow(t('From'), formatTimestamp(period.start)),
    labeledRow(t('To'), endTime),
  ].join('');
}

function openIssueFooter(issueShortId: string | null | undefined) {
  const clickToOpenText = issueShortId
    ? t('Click to open %s', issueShortId)
    : t('Click to open issue');

  return `<div class="tooltip-footer tooltip-footer-centered">${clickToOpenText}</div>`;
}

export function incidentSeriesTooltip(context: IncidentTooltipContext) {
  return [
    '<div class="tooltip-series">',
    titleRow(getIncidentPeriodTitle(context.period)),
    incidentPeriodTimeRows(context.period),
    priorityRow(context),
    '</div>',
    openIssueFooter(context.period.issueShortId),
    '<div class="tooltip-arrow arrow-top"></div>',
  ].join('');
}

export function incidentMarklineTooltip(context: IncidentTooltipContext) {
  return [
    '<div class="tooltip-series">',
    titleRow(t('Opened issue')),
    labeledRow(t('Started'), formatTimestamp(context.period.start)),
    priorityRow(context),
    '</div>',
    openIssueFooter(context.period.issueShortId),
    '<div class="tooltip-arrow arrow-top"></div>',
  ].join('');
}
