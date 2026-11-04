import {skipToken} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';

import type {TransactionThresholdMetric} from './transactionThresholdModal';

interface ThresholdResponse {
  metric: TransactionThresholdMetric;
  threshold: number;
}

interface TransactionThresholdApiOptionsParams {
  organization: Organization;
  project: Project | undefined;
  transactionName: string;
}

export function transactionThresholdOverrideApiOptions({
  organization,
  project,
  transactionName,
}: TransactionThresholdApiOptionsParams) {
  return apiOptions.as<ThresholdResponse>()(
    '/organizations/$organizationIdOrSlug/project-transaction-threshold-override/',
    {
      path: project ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: project ? {project: project.id, transaction: transactionName} : undefined,
      staleTime: 0,
    }
  );
}

export function projectTransactionThresholdApiOptions({
  organization,
  project,
}: Omit<TransactionThresholdApiOptionsParams, 'transactionName'>) {
  return apiOptions.as<ThresholdResponse>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/transaction-threshold/configure/',
    {
      path: project
        ? {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug}
        : skipToken,
      query: project ? {project: project.id} : undefined,
      staleTime: 0,
    }
  );
}
