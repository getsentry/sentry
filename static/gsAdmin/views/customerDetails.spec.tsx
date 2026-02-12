import {ThemeProvider} from '@emotion/react';
import {ConfigFixture} from 'sentry-fixture/config';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';
import {UserFixture} from 'sentry-fixture/user';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {BillingHistoryFixture} from 'getsentry-test/fixtures/billingHistory';
import {ChargeFixture} from 'getsentry-test/fixtures/charge';
import {InvoiceFixture} from 'getsentry-test/fixtures/invoice';
import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';
import {OnboardingTasksFixture} from 'getsentry-test/fixtures/onboardingTasks';
import {OwnerFixture} from 'getsentry-test/fixtures/owner';
import {PoliciesFixture} from 'getsentry-test/fixtures/policies';
import {ProjectFixture} from 'getsentry-test/fixtures/project';
import {SeerReservedBudgetFixture} from 'getsentry-test/fixtures/reservedBudget';
import {
  Am3DsEnterpriseSubscriptionFixture,
  SubscriptionFixture,
} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  renderHook,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import ConfigStore from 'sentry/stores/configStore';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';

import {getFreeEventsKey} from 'admin/components/addGiftEventsAction';
import type {StatsGroup} from 'admin/components/customers/customerStats';
import {populateChartData, useSeries} from 'admin/components/customers/customerStats';
import CustomerDetails from 'admin/views/customerDetails';
import type {Subscription} from 'getsentry/types';
import {BillingType, PlanTier} from 'getsentry/types';

const theme = ThemeFixture();
type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

type MockSubscription = Overwrite<
  Subscription,
  {
    isBillingAdmin?: boolean;
    pendingChanges?: boolean | Subscription['pendingChanges'];
    type?: BillingType;
  }
>;

interface Response {
  end: string;
  groups: StatsGroup[];
  intervals: Array<string | number>;
  start: string;
}

function Stats90DayFixture(): Response {
  return {
    start: '2021-04-21T00:00:00Z',
    end: '2021-07-20T22:18:00Z',
    intervals: [
      '2021-04-21T00:00:00Z',
      '2021-04-22T00:00:00Z',
      '2021-04-23T00:00:00Z',
      '2021-04-24T00:00:00Z',
      '2021-04-25T00:00:00Z',
      '2021-04-26T00:00:00Z',
      '2021-04-27T00:00:00Z',
      '2021-04-28T00:00:00Z',
      '2021-04-29T00:00:00Z',
      '2021-04-30T00:00:00Z',
      '2021-05-01T00:00:00Z',
      '2021-05-02T00:00:00Z',
      '2021-05-03T00:00:00Z',
      '2021-05-04T00:00:00Z',
      '2021-05-05T00:00:00Z',
      '2021-05-06T00:00:00Z',
      '2021-05-07T00:00:00Z',
      '2021-05-08T00:00:00Z',
      '2021-05-09T00:00:00Z',
      '2021-05-10T00:00:00Z',
      '2021-05-11T00:00:00Z',
      '2021-05-12T00:00:00Z',
      '2021-05-13T00:00:00Z',
      '2021-05-14T00:00:00Z',
      '2021-05-15T00:00:00Z',
      '2021-05-16T00:00:00Z',
      '2021-05-17T00:00:00Z',
      '2021-05-18T00:00:00Z',
      '2021-05-19T00:00:00Z',
      '2021-05-20T00:00:00Z',
      '2021-05-21T00:00:00Z',
      '2021-05-22T00:00:00Z',
      '2021-05-23T00:00:00Z',
      '2021-05-24T00:00:00Z',
      '2021-05-25T00:00:00Z',
      '2021-05-26T00:00:00Z',
      '2021-05-27T00:00:00Z',
      '2021-05-28T00:00:00Z',
      '2021-05-29T00:00:00Z',
      '2021-05-30T00:00:00Z',
      '2021-05-31T00:00:00Z',
      '2021-06-01T00:00:00Z',
      '2021-06-02T00:00:00Z',
      '2021-06-03T00:00:00Z',
      '2021-06-04T00:00:00Z',
      '2021-06-05T00:00:00Z',
      '2021-06-06T00:00:00Z',
      '2021-06-07T00:00:00Z',
      '2021-06-08T00:00:00Z',
      '2021-06-09T00:00:00Z',
      '2021-06-10T00:00:00Z',
      '2021-06-11T00:00:00Z',
      '2021-06-12T00:00:00Z',
      '2021-06-13T00:00:00Z',
      '2021-06-14T00:00:00Z',
      '2021-06-15T00:00:00Z',
      '2021-06-16T00:00:00Z',
      '2021-06-17T00:00:00Z',
      '2021-06-18T00:00:00Z',
      '2021-06-19T00:00:00Z',
      '2021-06-20T00:00:00Z',
      '2021-06-21T00:00:00Z',
      '2021-06-22T00:00:00Z',
      '2021-06-23T00:00:00Z',
      '2021-06-24T00:00:00Z',
      '2021-06-25T00:00:00Z',
      '2021-06-26T00:00:00Z',
      '2021-06-27T00:00:00Z',
      '2021-06-28T00:00:00Z',
      '2021-06-29T00:00:00Z',
      '2021-06-30T00:00:00Z',
      '2021-07-01T00:00:00Z',
      '2021-07-02T00:00:00Z',
      '2021-07-03T00:00:00Z',
      '2021-07-04T00:00:00Z',
      '2021-07-05T00:00:00Z',
      '2021-07-06T00:00:00Z',
      '2021-07-07T00:00:00Z',
      '2021-07-08T00:00:00Z',
      '2021-07-09T00:00:00Z',
      '2021-07-10T00:00:00Z',
      '2021-07-11T00:00:00Z',
      '2021-07-12T00:00:00Z',
      '2021-07-13T00:00:00Z',
      '2021-07-14T00:00:00Z',
      '2021-07-15T00:00:00Z',
      '2021-07-16T00:00:00Z',
      '2021-07-17T00:00:00Z',
      '2021-07-18T00:00:00Z',
      '2021-07-19T00:00:00Z',
      '2021-07-20T00:00:00Z',
    ],
    groups: [
      {
        by: {
          outcome: 'invalid',
          reason: 'browser-extensions',
        },
        totals: {
          'sum(quantity)': 2300000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 300000, 300000, 300000, 300000, 300000, 300000, 300000, 200000, 0,
          ],
        },
      },
      {
        by: {
          reason: 'cors',
          outcome: 'invalid',
        },
        totals: {
          'sum(quantity)': 2300000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 200000, 300000, 300000, 300000, 300000, 300000, 300000, 300000, 0,
          ],
        },
      },
      {
        by: {
          reason: 'grace_period',
          outcome: 'invalid',
        },
        totals: {
          'sum(quantity)': 2200000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 200000, 300000, 300000, 300000, 300000, 300000, 300000, 200000, 0,
          ],
        },
      },
      {
        by: {
          reason: 'usage_exceeded',
          outcome: 'invalid',
        },
        totals: {
          'sum(quantity)': 2200000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 200000, 300000, 300000, 300000, 300000, 300000, 300000, 200000, 0,
          ],
        },
      },
      {
        by: {
          reason: 'web-crawlers',
          outcome: 'invalid',
        },
        totals: {
          'sum(quantity)': 2300000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 300000, 300000, 300000, 300000, 300000, 300000, 300000, 200000, 0,
          ],
        },
      },
      {
        by: {
          outcome: 'rate_limited',
          reason: 'none',
        },
        totals: {
          'sum(quantity)': 18000000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 1900000, 2400000, 2400000, 2400000, 2400000, 2400000, 2400000,
            1700000, 0,
          ],
        },
      },
      {
        by: {
          reason: 'error-message',
          outcome: 'invalid',
        },
        totals: {
          'sum(quantity)': 2200000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 200000, 300000, 300000, 300000, 300000, 300000, 300000, 200000, 0,
          ],
        },
      },
      {
        by: {
          reason: 'legacy-browsers',
          outcome: 'invalid',
        },
        totals: {
          'sum(quantity)': 2300000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 300000, 300000, 300000, 300000, 300000, 300000, 300000, 200000, 0,
          ],
        },
      },
      {
        by: {
          reason: 'localhost',
          outcome: 'invalid',
        },
        totals: {
          'sum(quantity)': 2200000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 200000, 300000, 300000, 300000, 300000, 300000, 300000, 200000, 0,
          ],
        },
      },
      {
        by: {
          outcome: 'filtered',
          reason: 'none',
        },
        totals: {
          'sum(quantity)': 18000000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 1900000, 2400000, 2400000, 2400000, 2400000, 2400000, 2400000,
            1700000, 0,
          ],
        },
      },
      {
        by: {
          reason: 'none',
          outcome: 'accepted',
        },
        totals: {
          'sum(quantity)': 18000000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 1900000, 2400000, 2400000, 2400000, 2400000, 2400000, 2400000,
            1700000, 0,
          ],
        },
      },
    ],
  };
}

function StatsBillingPeriodFixture(): Response {
  return {
    start: '2021-06-29T00:00:00Z',
    end: '2021-07-20T20:12:00Z',
    intervals: [
      '2021-06-29T00:00:00Z',
      '2021-06-30T00:00:00Z',
      '2021-07-01T00:00:00Z',
      '2021-07-02T00:00:00Z',
      '2021-07-03T00:00:00Z',
      '2021-07-04T00:00:00Z',
      '2021-07-05T00:00:00Z',
      '2021-07-06T00:00:00Z',
      '2021-07-07T00:00:00Z',
      '2021-07-08T00:00:00Z',
      '2021-07-09T00:00:00Z',
      '2021-07-10T00:00:00Z',
      '2021-07-11T00:00:00Z',
      '2021-07-12T00:00:00Z',
      '2021-07-13T00:00:00Z',
      '2021-07-14T00:00:00Z',
      '2021-07-15T00:00:00Z',
      '2021-07-16T00:00:00Z',
      '2021-07-17T00:00:00Z',
      '2021-07-18T00:00:00Z',
      '2021-07-19T00:00:00Z',
      '2021-07-20T00:00:00Z',
    ],
    groups: [
      {
        by: {
          outcome: 'filtered',
          reason: 'none',
        },
        totals: {
          'sum(quantity)': 4000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 500, 500, 500, 500, 500, 500, 500, 500,
            0,
          ],
        },
      },
      {
        by: {
          outcome: 'filtered',
          reason: 'browser-extensions',
        },
        totals: {
          'sum(quantity)': 8000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000,
            1000, 1000, 0,
          ],
        },
      },
      {
        by: {
          outcome: 'filtered',
          reason: 'Sampled:3',
        },
        totals: {
          'sum(quantity)': 3558,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3558, 0,
          ],
        },
      },
      {
        by: {
          outcome: 'filtered',
          reason: 'Sampled:4',
        },
        totals: {
          'sum(quantity)': 1404,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1404, 0,
          ],
        },
      },
      {
        by: {
          outcome: 'rate_limited',
          reason: 'grace_period',
        },
        totals: {
          'sum(quantity)': 8000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000,
            1000, 1000, 0,
          ],
        },
      },
      {
        by: {
          outcome: 'rate_limited',
          reason: 'browser-extensions',
        },
        totals: {
          'sum(quantity)': 8000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000,
            1000, 1000, 0,
          ],
        },
      },
      {
        by: {
          outcome: 'invalid',
          reason: 'legacy-browsers',
        },
        totals: {
          'sum(quantity)': 8000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000,
            1000, 1000, 0,
          ],
        },
      },
      {
        by: {
          reason: 'error-message',
          outcome: 'invalid',
        },
        totals: {
          'sum(quantity)': 8000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000,
            1000, 1000, 0,
          ],
        },
      },
      {
        by: {
          outcome: 'invalid',
          reason: 'cors',
        },
        totals: {
          'sum(quantity)': 8000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000,
            1000, 1000, 0,
          ],
        },
      },
      {
        by: {
          reason: 'project_abuse_limit',
          outcome: 'rate_limited',
        },
        totals: {
          'sum(quantity)': 8000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000,
            1000, 1000, 0,
          ],
        },
      },
      {
        by: {
          reason: 'localhost',
          outcome: 'invalid',
        },
        totals: {
          'sum(quantity)': 8000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000,
            1000, 1000, 0,
          ],
        },
      },
      {
        by: {
          outcome: 'accepted',
          reason: 'none',
        },
        totals: {
          'sum(quantity)': 8000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000,
            1000, 1000, 0,
          ],
        },
      },
      {
        by: {
          outcome: 'rate_limited',
          reason: 'usage_exceeded',
        },
        totals: {
          'sum(quantity)': 8000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000,
            1000, 1000, 0,
          ],
        },
      },
      {
        by: {
          reason: 'web-crawlers',
          outcome: 'invalid',
        },
        totals: {
          'sum(quantity)': 8000,
        },
        series: {
          'sum(quantity)': [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000, 1000, 1000, 1000, 1000, 1000,
            1000, 1000, 0,
          ],
        },
      },
    ],
  };
}

function setUpMocks(
  organization: Organization,
  subscription?: Partial<MockSubscription>
) {
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/`,
    body: organization,
  });
  MockApiClient.addMockResponse({
    url: `/customers/${organization.slug}/`,
    body: {
      organization,
      ...SubscriptionFixture({organization, plan: 'am1_f'}),
      ...subscription,
    },
  });
  MockApiClient.addMockResponse({
    url: `/customers/${organization.slug}/billing-config/?tier=all`,
    body: BillingConfigFixture(PlanTier.ALL),
  });
  // TODO(isabella): remove this once all billing config api calls are updated to use tier=all
  MockApiClient.addMockResponse({
    url: `/customers/${organization.slug}/billing-config/?tier=mm2`,
    body: BillingConfigFixture(PlanTier.MM2),
  });
  MockApiClient.addMockResponse({
    url: `/customers/${organization.slug}/billing-config/?tier=am1`,
    body: BillingConfigFixture(PlanTier.AM1),
  });
  MockApiClient.addMockResponse({
    url: `/customers/${organization.slug}/billing-config/?tier=am2`,
    body: BillingConfigFixture(PlanTier.AM2),
  });
  MockApiClient.addMockResponse({
    url: `/customers/${organization.slug}/billing-config/?tier=am3`,
    body: BillingConfigFixture(PlanTier.AM3),
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/stats_v2/`,
    body: StatsBillingPeriodFixture(),
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/stats_v2/?start=1619037805.962&end=1626813805.962`,
    body: Stats90DayFixture(),
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/members/`,
    body: [OwnerFixture()],
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/projects/?statsPeriod=30d`,
    body: [ProjectFixture({})],
  });
  MockApiClient.addMockResponse({
    url: `/customers/${organization.slug}/history/`,
    body: [BillingHistoryFixture()],
  });
  MockApiClient.addMockResponse({
    url: `/internal-stats/${organization.slug}/onboarding-tasks/`,
    body: OnboardingTasksFixture(),
  });
  MockApiClient.addMockResponse({
    url: `/customers/${organization.slug}/policies/`,
    body: PoliciesFixture(),
  });
  MockApiClient.addMockResponse({
    url: `/customers/${organization.slug}/invoices/`,
    body: [InvoiceFixture()],
  });
  MockApiClient.addMockResponse({
    url: `/customers/${organization.slug}/charges/`,
    body: [ChargeFixture({})],
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/`,
    body: organization,
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/projects/`,
    body: [],
  });
  MockApiClient.addMockResponse({
    url: `/customers/${organization.slug}/integrations/`,
    body: [],
  });
}

describe('Customer Details', () => {
  const {organization} = initializeOrg();

  const mockUser = UserFixture({permissions: new Set([])});
  ConfigStore.loadInitialData(ConfigFixture({user: mockUser}));

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('populates chart data', () => {
    setUpMocks(organization);

    const data = StatsBillingPeriodFixture();

    const {result: chartData} = renderHook(
      () => {
        const series = useSeries();
        return populateChartData(data.intervals, data.groups, series);
      },
      {
        wrapper: ({children}) => {
          return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
        },
      }
    );

    expect(chartData.current).toEqual([
      {
        seriesName: 'Accepted',
        data: [
          {name: '2021-06-29T00:00:00Z', value: 0},
          {name: '2021-06-30T00:00:00Z', value: 0},
          {name: '2021-07-01T00:00:00Z', value: 0},
          {name: '2021-07-02T00:00:00Z', value: 0},
          {name: '2021-07-03T00:00:00Z', value: 0},
          {name: '2021-07-04T00:00:00Z', value: 0},
          {name: '2021-07-05T00:00:00Z', value: 0},
          {name: '2021-07-06T00:00:00Z', value: 0},
          {name: '2021-07-07T00:00:00Z', value: 0},
          {name: '2021-07-08T00:00:00Z', value: 0},
          {name: '2021-07-09T00:00:00Z', value: 0},
          {name: '2021-07-10T00:00:00Z', value: 0},
          {name: '2021-07-11T00:00:00Z', value: 0},
          {name: '2021-07-12T00:00:00Z', value: 1000},
          {name: '2021-07-13T00:00:00Z', value: 1000},
          {name: '2021-07-14T00:00:00Z', value: 1000},
          {name: '2021-07-15T00:00:00Z', value: 1000},
          {name: '2021-07-16T00:00:00Z', value: 1000},
          {name: '2021-07-17T00:00:00Z', value: 1000},
          {name: '2021-07-18T00:00:00Z', value: 1000},
          {name: '2021-07-19T00:00:00Z', value: 1000},
          {name: '2021-07-20T00:00:00Z', value: 0},
        ],
        color: theme.tokens.graphics.accent.vibrant,
      },
      {
        seriesName: 'Filtered (Server)',
        data: [
          {name: '2021-06-29T00:00:00Z', value: 0},
          {name: '2021-06-30T00:00:00Z', value: 0},
          {name: '2021-07-01T00:00:00Z', value: 0},
          {name: '2021-07-02T00:00:00Z', value: 0},
          {name: '2021-07-03T00:00:00Z', value: 0},
          {name: '2021-07-04T00:00:00Z', value: 0},
          {name: '2021-07-05T00:00:00Z', value: 0},
          {name: '2021-07-06T00:00:00Z', value: 0},
          {name: '2021-07-07T00:00:00Z', value: 0},
          {name: '2021-07-08T00:00:00Z', value: 0},
          {name: '2021-07-09T00:00:00Z', value: 0},
          {name: '2021-07-10T00:00:00Z', value: 0},
          {name: '2021-07-11T00:00:00Z', value: 0},
          {name: '2021-07-12T00:00:00Z', value: 1500},
          {name: '2021-07-13T00:00:00Z', value: 1500},
          {name: '2021-07-14T00:00:00Z', value: 1500},
          {name: '2021-07-15T00:00:00Z', value: 1500},
          {name: '2021-07-16T00:00:00Z', value: 1500},
          {name: '2021-07-17T00:00:00Z', value: 1500},
          {name: '2021-07-18T00:00:00Z', value: 1500},
          {name: '2021-07-19T00:00:00Z', value: 6462},
          {name: '2021-07-20T00:00:00Z', value: 0},
        ],
        subSeries: [
          {
            seriesName: 'None',
            data: [
              {name: '2021-06-29T00:00:00Z', value: 0},
              {name: '2021-06-30T00:00:00Z', value: 0},
              {name: '2021-07-01T00:00:00Z', value: 0},
              {name: '2021-07-02T00:00:00Z', value: 0},
              {name: '2021-07-03T00:00:00Z', value: 0},
              {name: '2021-07-04T00:00:00Z', value: 0},
              {name: '2021-07-05T00:00:00Z', value: 0},
              {name: '2021-07-06T00:00:00Z', value: 0},
              {name: '2021-07-07T00:00:00Z', value: 0},
              {name: '2021-07-08T00:00:00Z', value: 0},
              {name: '2021-07-09T00:00:00Z', value: 0},
              {name: '2021-07-10T00:00:00Z', value: 0},
              {name: '2021-07-11T00:00:00Z', value: 0},
              {name: '2021-07-12T00:00:00Z', value: 500},
              {name: '2021-07-13T00:00:00Z', value: 500},
              {name: '2021-07-14T00:00:00Z', value: 500},
              {name: '2021-07-15T00:00:00Z', value: 500},
              {name: '2021-07-16T00:00:00Z', value: 500},
              {name: '2021-07-17T00:00:00Z', value: 500},
              {name: '2021-07-18T00:00:00Z', value: 500},
              {name: '2021-07-19T00:00:00Z', value: 500},
              {name: '2021-07-20T00:00:00Z', value: 0},
            ],
          },
          {
            seriesName: 'Browser Extensions',
            data: [
              {name: '2021-06-29T00:00:00Z', value: 0},
              {name: '2021-06-30T00:00:00Z', value: 0},
              {name: '2021-07-01T00:00:00Z', value: 0},
              {name: '2021-07-02T00:00:00Z', value: 0},
              {name: '2021-07-03T00:00:00Z', value: 0},
              {name: '2021-07-04T00:00:00Z', value: 0},
              {name: '2021-07-05T00:00:00Z', value: 0},
              {name: '2021-07-06T00:00:00Z', value: 0},
              {name: '2021-07-07T00:00:00Z', value: 0},
              {name: '2021-07-08T00:00:00Z', value: 0},
              {name: '2021-07-09T00:00:00Z', value: 0},
              {name: '2021-07-10T00:00:00Z', value: 0},
              {name: '2021-07-11T00:00:00Z', value: 0},
              {name: '2021-07-12T00:00:00Z', value: 1000},
              {name: '2021-07-13T00:00:00Z', value: 1000},
              {name: '2021-07-14T00:00:00Z', value: 1000},
              {name: '2021-07-15T00:00:00Z', value: 1000},
              {name: '2021-07-16T00:00:00Z', value: 1000},
              {name: '2021-07-17T00:00:00Z', value: 1000},
              {name: '2021-07-18T00:00:00Z', value: 1000},
              {name: '2021-07-19T00:00:00Z', value: 1000},
              {name: '2021-07-20T00:00:00Z', value: 0},
            ],
          },
          {
            seriesName: 'Dynamic Sampling',
            data: [
              {name: '2021-06-29T00:00:00Z', value: 0},
              {name: '2021-06-30T00:00:00Z', value: 0},
              {name: '2021-07-01T00:00:00Z', value: 0},
              {name: '2021-07-02T00:00:00Z', value: 0},
              {name: '2021-07-03T00:00:00Z', value: 0},
              {name: '2021-07-04T00:00:00Z', value: 0},
              {name: '2021-07-05T00:00:00Z', value: 0},
              {name: '2021-07-06T00:00:00Z', value: 0},
              {name: '2021-07-07T00:00:00Z', value: 0},
              {name: '2021-07-08T00:00:00Z', value: 0},
              {name: '2021-07-09T00:00:00Z', value: 0},
              {name: '2021-07-10T00:00:00Z', value: 0},
              {name: '2021-07-11T00:00:00Z', value: 0},
              {name: '2021-07-12T00:00:00Z', value: 0},
              {name: '2021-07-13T00:00:00Z', value: 0},
              {name: '2021-07-14T00:00:00Z', value: 0},
              {name: '2021-07-15T00:00:00Z', value: 0},
              {name: '2021-07-16T00:00:00Z', value: 0},
              {name: '2021-07-17T00:00:00Z', value: 0},
              {name: '2021-07-18T00:00:00Z', value: 0},
              {name: '2021-07-19T00:00:00Z', value: 4962},
              {name: '2021-07-20T00:00:00Z', value: 0},
            ],
          },
        ],
        color: theme.tokens.graphics.accent.moderate,
      },
      {
        seriesName: 'Over Quota',
        data: [
          {name: '2021-06-29T00:00:00Z', value: 0},
          {name: '2021-06-30T00:00:00Z', value: 0},
          {name: '2021-07-01T00:00:00Z', value: 0},
          {name: '2021-07-02T00:00:00Z', value: 0},
          {name: '2021-07-03T00:00:00Z', value: 0},
          {name: '2021-07-04T00:00:00Z', value: 0},
          {name: '2021-07-05T00:00:00Z', value: 0},
          {name: '2021-07-06T00:00:00Z', value: 0},
          {name: '2021-07-07T00:00:00Z', value: 0},
          {name: '2021-07-08T00:00:00Z', value: 0},
          {name: '2021-07-09T00:00:00Z', value: 0},
          {name: '2021-07-10T00:00:00Z', value: 0},
          {name: '2021-07-11T00:00:00Z', value: 0},
          {name: '2021-07-12T00:00:00Z', value: 2000},
          {name: '2021-07-13T00:00:00Z', value: 2000},
          {name: '2021-07-14T00:00:00Z', value: 2000},
          {name: '2021-07-15T00:00:00Z', value: 2000},
          {name: '2021-07-16T00:00:00Z', value: 2000},
          {name: '2021-07-17T00:00:00Z', value: 2000},
          {name: '2021-07-18T00:00:00Z', value: 2000},
          {name: '2021-07-19T00:00:00Z', value: 2000},
          {name: '2021-07-20T00:00:00Z', value: 0},
        ],
        color: theme.tokens.graphics.promotion.moderate,
      },
      {
        seriesName: 'Discarded (Client)',
        data: [],
        color: theme.tokens.graphics.warning.vibrant,
      },
      {
        seriesName: 'Dropped (Server)',
        data: [
          {name: '2021-06-29T00:00:00Z', value: 0},
          {name: '2021-06-30T00:00:00Z', value: 0},
          {name: '2021-07-01T00:00:00Z', value: 0},
          {name: '2021-07-02T00:00:00Z', value: 0},
          {name: '2021-07-03T00:00:00Z', value: 0},
          {name: '2021-07-04T00:00:00Z', value: 0},
          {name: '2021-07-05T00:00:00Z', value: 0},
          {name: '2021-07-06T00:00:00Z', value: 0},
          {name: '2021-07-07T00:00:00Z', value: 0},
          {name: '2021-07-08T00:00:00Z', value: 0},
          {name: '2021-07-09T00:00:00Z', value: 0},
          {name: '2021-07-10T00:00:00Z', value: 0},
          {name: '2021-07-11T00:00:00Z', value: 0},
          {name: '2021-07-12T00:00:00Z', value: 7000},
          {name: '2021-07-13T00:00:00Z', value: 7000},
          {name: '2021-07-14T00:00:00Z', value: 7000},
          {name: '2021-07-15T00:00:00Z', value: 7000},
          {name: '2021-07-16T00:00:00Z', value: 7000},
          {name: '2021-07-17T00:00:00Z', value: 7000},
          {name: '2021-07-18T00:00:00Z', value: 7000},
          {name: '2021-07-19T00:00:00Z', value: 7000},
          {name: '2021-07-20T00:00:00Z', value: 0},
        ],
        subSeries: [
          {
            seriesName: 'Browser Extensions',
            data: [
              {name: '2021-06-29T00:00:00Z', value: 0},
              {name: '2021-06-30T00:00:00Z', value: 0},
              {name: '2021-07-01T00:00:00Z', value: 0},
              {name: '2021-07-02T00:00:00Z', value: 0},
              {name: '2021-07-03T00:00:00Z', value: 0},
              {name: '2021-07-04T00:00:00Z', value: 0},
              {name: '2021-07-05T00:00:00Z', value: 0},
              {name: '2021-07-06T00:00:00Z', value: 0},
              {name: '2021-07-07T00:00:00Z', value: 0},
              {name: '2021-07-08T00:00:00Z', value: 0},
              {name: '2021-07-09T00:00:00Z', value: 0},
              {name: '2021-07-10T00:00:00Z', value: 0},
              {name: '2021-07-11T00:00:00Z', value: 0},
              {name: '2021-07-12T00:00:00Z', value: 1000},
              {name: '2021-07-13T00:00:00Z', value: 1000},
              {name: '2021-07-14T00:00:00Z', value: 1000},
              {name: '2021-07-15T00:00:00Z', value: 1000},
              {name: '2021-07-16T00:00:00Z', value: 1000},
              {name: '2021-07-17T00:00:00Z', value: 1000},
              {name: '2021-07-18T00:00:00Z', value: 1000},
              {name: '2021-07-19T00:00:00Z', value: 1000},
              {name: '2021-07-20T00:00:00Z', value: 0},
            ],
          },
          {
            seriesName: 'Legacy Browsers',
            data: [
              {name: '2021-06-29T00:00:00Z', value: 0},
              {name: '2021-06-30T00:00:00Z', value: 0},
              {name: '2021-07-01T00:00:00Z', value: 0},
              {name: '2021-07-02T00:00:00Z', value: 0},
              {name: '2021-07-03T00:00:00Z', value: 0},
              {name: '2021-07-04T00:00:00Z', value: 0},
              {name: '2021-07-05T00:00:00Z', value: 0},
              {name: '2021-07-06T00:00:00Z', value: 0},
              {name: '2021-07-07T00:00:00Z', value: 0},
              {name: '2021-07-08T00:00:00Z', value: 0},
              {name: '2021-07-09T00:00:00Z', value: 0},
              {name: '2021-07-10T00:00:00Z', value: 0},
              {name: '2021-07-11T00:00:00Z', value: 0},
              {name: '2021-07-12T00:00:00Z', value: 1000},
              {name: '2021-07-13T00:00:00Z', value: 1000},
              {name: '2021-07-14T00:00:00Z', value: 1000},
              {name: '2021-07-15T00:00:00Z', value: 1000},
              {name: '2021-07-16T00:00:00Z', value: 1000},
              {name: '2021-07-17T00:00:00Z', value: 1000},
              {name: '2021-07-18T00:00:00Z', value: 1000},
              {name: '2021-07-19T00:00:00Z', value: 1000},
              {name: '2021-07-20T00:00:00Z', value: 0},
            ],
          },
          {
            seriesName: 'Error Message',
            data: [
              {name: '2021-06-29T00:00:00Z', value: 0},
              {name: '2021-06-30T00:00:00Z', value: 0},
              {name: '2021-07-01T00:00:00Z', value: 0},
              {name: '2021-07-02T00:00:00Z', value: 0},
              {name: '2021-07-03T00:00:00Z', value: 0},
              {name: '2021-07-04T00:00:00Z', value: 0},
              {name: '2021-07-05T00:00:00Z', value: 0},
              {name: '2021-07-06T00:00:00Z', value: 0},
              {name: '2021-07-07T00:00:00Z', value: 0},
              {name: '2021-07-08T00:00:00Z', value: 0},
              {name: '2021-07-09T00:00:00Z', value: 0},
              {name: '2021-07-10T00:00:00Z', value: 0},
              {name: '2021-07-11T00:00:00Z', value: 0},
              {name: '2021-07-12T00:00:00Z', value: 1000},
              {name: '2021-07-13T00:00:00Z', value: 1000},
              {name: '2021-07-14T00:00:00Z', value: 1000},
              {name: '2021-07-15T00:00:00Z', value: 1000},
              {name: '2021-07-16T00:00:00Z', value: 1000},
              {name: '2021-07-17T00:00:00Z', value: 1000},
              {name: '2021-07-18T00:00:00Z', value: 1000},
              {name: '2021-07-19T00:00:00Z', value: 1000},
              {name: '2021-07-20T00:00:00Z', value: 0},
            ],
          },
          {
            seriesName: 'Cors',
            data: [
              {name: '2021-06-29T00:00:00Z', value: 0},
              {name: '2021-06-30T00:00:00Z', value: 0},
              {name: '2021-07-01T00:00:00Z', value: 0},
              {name: '2021-07-02T00:00:00Z', value: 0},
              {name: '2021-07-03T00:00:00Z', value: 0},
              {name: '2021-07-04T00:00:00Z', value: 0},
              {name: '2021-07-05T00:00:00Z', value: 0},
              {name: '2021-07-06T00:00:00Z', value: 0},
              {name: '2021-07-07T00:00:00Z', value: 0},
              {name: '2021-07-08T00:00:00Z', value: 0},
              {name: '2021-07-09T00:00:00Z', value: 0},
              {name: '2021-07-10T00:00:00Z', value: 0},
              {name: '2021-07-11T00:00:00Z', value: 0},
              {name: '2021-07-12T00:00:00Z', value: 1000},
              {name: '2021-07-13T00:00:00Z', value: 1000},
              {name: '2021-07-14T00:00:00Z', value: 1000},
              {name: '2021-07-15T00:00:00Z', value: 1000},
              {name: '2021-07-16T00:00:00Z', value: 1000},
              {name: '2021-07-17T00:00:00Z', value: 1000},
              {name: '2021-07-18T00:00:00Z', value: 1000},
              {name: '2021-07-19T00:00:00Z', value: 1000},
              {name: '2021-07-20T00:00:00Z', value: 0},
            ],
          },
          {
            seriesName: 'Project Abuse Limit',
            data: [
              {name: '2021-06-29T00:00:00Z', value: 0},
              {name: '2021-06-30T00:00:00Z', value: 0},
              {name: '2021-07-01T00:00:00Z', value: 0},
              {name: '2021-07-02T00:00:00Z', value: 0},
              {name: '2021-07-03T00:00:00Z', value: 0},
              {name: '2021-07-04T00:00:00Z', value: 0},
              {name: '2021-07-05T00:00:00Z', value: 0},
              {name: '2021-07-06T00:00:00Z', value: 0},
              {name: '2021-07-07T00:00:00Z', value: 0},
              {name: '2021-07-08T00:00:00Z', value: 0},
              {name: '2021-07-09T00:00:00Z', value: 0},
              {name: '2021-07-10T00:00:00Z', value: 0},
              {name: '2021-07-11T00:00:00Z', value: 0},
              {name: '2021-07-12T00:00:00Z', value: 1000},
              {name: '2021-07-13T00:00:00Z', value: 1000},
              {name: '2021-07-14T00:00:00Z', value: 1000},
              {name: '2021-07-15T00:00:00Z', value: 1000},
              {name: '2021-07-16T00:00:00Z', value: 1000},
              {name: '2021-07-17T00:00:00Z', value: 1000},
              {name: '2021-07-18T00:00:00Z', value: 1000},
              {name: '2021-07-19T00:00:00Z', value: 1000},
              {name: '2021-07-20T00:00:00Z', value: 0},
            ],
          },
          {
            seriesName: 'Localhost',
            data: [
              {name: '2021-06-29T00:00:00Z', value: 0},
              {name: '2021-06-30T00:00:00Z', value: 0},
              {name: '2021-07-01T00:00:00Z', value: 0},
              {name: '2021-07-02T00:00:00Z', value: 0},
              {name: '2021-07-03T00:00:00Z', value: 0},
              {name: '2021-07-04T00:00:00Z', value: 0},
              {name: '2021-07-05T00:00:00Z', value: 0},
              {name: '2021-07-06T00:00:00Z', value: 0},
              {name: '2021-07-07T00:00:00Z', value: 0},
              {name: '2021-07-08T00:00:00Z', value: 0},
              {name: '2021-07-09T00:00:00Z', value: 0},
              {name: '2021-07-10T00:00:00Z', value: 0},
              {name: '2021-07-11T00:00:00Z', value: 0},
              {name: '2021-07-12T00:00:00Z', value: 1000},
              {name: '2021-07-13T00:00:00Z', value: 1000},
              {name: '2021-07-14T00:00:00Z', value: 1000},
              {name: '2021-07-15T00:00:00Z', value: 1000},
              {name: '2021-07-16T00:00:00Z', value: 1000},
              {name: '2021-07-17T00:00:00Z', value: 1000},
              {name: '2021-07-18T00:00:00Z', value: 1000},
              {name: '2021-07-19T00:00:00Z', value: 1000},
              {name: '2021-07-20T00:00:00Z', value: 0},
            ],
          },
          {
            seriesName: 'Web Crawlers',
            data: [
              {name: '2021-06-29T00:00:00Z', value: 0},
              {name: '2021-06-30T00:00:00Z', value: 0},
              {name: '2021-07-01T00:00:00Z', value: 0},
              {name: '2021-07-02T00:00:00Z', value: 0},
              {name: '2021-07-03T00:00:00Z', value: 0},
              {name: '2021-07-04T00:00:00Z', value: 0},
              {name: '2021-07-05T00:00:00Z', value: 0},
              {name: '2021-07-06T00:00:00Z', value: 0},
              {name: '2021-07-07T00:00:00Z', value: 0},
              {name: '2021-07-08T00:00:00Z', value: 0},
              {name: '2021-07-09T00:00:00Z', value: 0},
              {name: '2021-07-10T00:00:00Z', value: 0},
              {name: '2021-07-11T00:00:00Z', value: 0},
              {name: '2021-07-12T00:00:00Z', value: 1000},
              {name: '2021-07-13T00:00:00Z', value: 1000},
              {name: '2021-07-14T00:00:00Z', value: 1000},
              {name: '2021-07-15T00:00:00Z', value: 1000},
              {name: '2021-07-16T00:00:00Z', value: 1000},
              {name: '2021-07-17T00:00:00Z', value: 1000},
              {name: '2021-07-18T00:00:00Z', value: 1000},
              {name: '2021-07-19T00:00:00Z', value: 1000},
              {name: '2021-07-20T00:00:00Z', value: 0},
            ],
          },
        ],
        color: theme.tokens.graphics.danger.vibrant,
      },
    ]);
  });

  it('renders correct sections', async () => {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_f',
      planTier: 'am3',
    });
    subscription.reservedBudgets = [
      SeerReservedBudgetFixture({
        id: '0',
        reservedBudget: 0,
      }),
    ];
    setUpMocks(organization, subscription);

    render(<CustomerDetails />, {
      initialRouterConfig: {
        location: {pathname: `/customers/${organization.slug}`},
        route: `/customers/:orgId`,
      },
      organization,
    });

    await screen.findByRole('heading', {name: 'Customers'});
  });

  it('renders correct dropdown options', async () => {
    setUpMocks(organization);

    render(<CustomerDetails />, {
      initialRouterConfig: {
        location: {pathname: `/customers/${organization.slug}`},
        route: `/customers/:orgId`,
      },
      organization,
    });

    await screen.findByRole('heading', {name: 'Customers'});

    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Customers Actions',
      })[0]!
    );

    expect(screen.getByRole('option', {name: /Start Trial/})).toBeInTheDocument();
    expect(
      screen.getByRole('option', {name: /Convert to Sponsored/})
    ).toBeInTheDocument();
    expect(screen.getByRole('option', {name: /Gift errors/})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: /Gift transactions/})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: /Gift attachments/})).toBeInTheDocument();
    expect(
      screen.queryByRole('option', {name: /Gift to reserved budget/})
    ).not.toBeInTheDocument();
    expect(screen.getByRole('option', {name: /Change Plan/})).toBeInTheDocument();
    expect(
      screen.getByRole('option', {name: /Start Enterprise Trial/})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', {name: /Change Google Domain/})
    ).toBeInTheDocument();
    expect(screen.getByRole('option', {name: /Suspend Account/})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: /Add Legacy Soft Cap/})).toBeInTheDocument();
  });

  it('renders and hides generic confirmation modals', async () => {
    setUpMocks(organization);

    render(<CustomerDetails />, {
      initialRouterConfig: {
        location: {pathname: `/customers/${organization.slug}`},
        route: `/customers/:orgId`,
      },
      organization,
    });

    await screen.findByRole('heading', {name: 'Customers'});

    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Customers Actions',
      })[0]!
    );

    await userEvent.click(screen.getByText('Convert to Sponsored'));

    const {waitForModalToHide} = renderGlobalModal();

    expect(
      screen.getByRole('heading', {name: 'Convert to Sponsored'})
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Confirm'})).toBeInTheDocument();

    // Close Modal
    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    await waitForModalToHide();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('change legacy soft cap', () => {
    const softCapOrg = OrganizationFixture({slug: 'soft-cap'});
    const mockBillingAdminUser = UserFixture({
      permissions: new Set(['billing.admin']),
    });

    it('renders disabled without billing.admin permissions', async () => {
      ConfigStore.set('user', mockUser);

      setUpMocks(organization, {isBillingAdmin: false});

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {name: 'Customers Actions'})[0]!
      );

      expect(screen.getByTestId('changeSoftCap')).toHaveAttribute(
        'aria-disabled',
        'true'
      );

      await userEvent.hover(
        within(screen.getByTestId('changeSoftCap')).getByText('Add Legacy Soft Cap')
      );

      expect(
        await screen.findByText('Requires billing admin permissions.')
      ).toBeInTheDocument();
    });

    it('renders enabled with billing.admin permissions', async () => {
      ConfigStore.set('user', mockBillingAdminUser);
      setUpMocks(softCapOrg, {isPartner: false});

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${softCapOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: softCapOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(screen.getByText('Add Legacy Soft Cap')).toBeInTheDocument();
    });

    it('renders disabled if legacy soft cap already enabled', async () => {
      ConfigStore.set('user', mockBillingAdminUser);
      setUpMocks(softCapOrg, {isPartner: false, hasSoftCap: true});

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${softCapOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: softCapOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(screen.getByText('Remove Legacy Soft Cap')).toBeInTheDocument();
    });

    it('enables legacy soft cap', async () => {
      ConfigStore.set('user', mockBillingAdminUser);
      setUpMocks(softCapOrg, {isPartner: false, hasSoftCap: false});

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${softCapOrg.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${softCapOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: softCapOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      await userEvent.click(screen.getByText('Add Legacy Soft Cap'));

      renderGlobalModal();

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      await waitFor(() =>
        expect(updateMock).toHaveBeenCalledWith(
          `/customers/${softCapOrg.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              softCap: true,
            },
          })
        )
      );
    });

    it('disables legacy soft cap', async () => {
      ConfigStore.set('user', mockBillingAdminUser);
      setUpMocks(softCapOrg, {isPartner: false, hasSoftCap: true});

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${softCapOrg.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${softCapOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: softCapOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      await userEvent.click(screen.getByText('Remove Legacy Soft Cap'));

      renderGlobalModal();

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      await waitFor(() =>
        expect(updateMock).toHaveBeenCalledWith(
          `/customers/${softCapOrg.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              softCap: false,
            },
          })
        )
      );
    });
  });

  describe('change overage notifications', () => {
    const softCapOrg = OrganizationFixture({slug: 'soft-cap'});
    const noNotificationsOrg = OrganizationFixture();

    const mockBillingAdminUser = UserFixture({
      permissions: new Set(['billing.admin']),
    });

    it('renders disable option with billing.admin permissions', async () => {
      ConfigStore.set('user', mockBillingAdminUser);
      setUpMocks(softCapOrg, {hasOverageNotificationsDisabled: false, hasSoftCap: true});
      setUpMocks(noNotificationsOrg, {
        hasOverageNotificationsDisabled: false,
        hasSoftCap: true,
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${softCapOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: softCapOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(screen.getByText('Disable Overage Notification')).toBeInTheDocument();
    });

    it('renders enabled option with billing.admin permissions', async () => {
      ConfigStore.set('user', mockBillingAdminUser);
      setUpMocks(softCapOrg, {hasOverageNotificationsDisabled: true, hasSoftCap: true});
      setUpMocks(noNotificationsOrg, {
        hasOverageNotificationsDisabled: true,
        hasSoftCap: true,
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${softCapOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: softCapOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(screen.getByText('Enable Overage Notification')).toBeInTheDocument();
    });

    it('disables overage notifications', async () => {
      ConfigStore.set('user', mockBillingAdminUser);
      setUpMocks(softCapOrg, {hasOverageNotificationsDisabled: false, hasSoftCap: true});
      setUpMocks(noNotificationsOrg, {
        hasOverageNotificationsDisabled: false,
        hasSoftCap: true,
      });

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${softCapOrg.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${softCapOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: softCapOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      await userEvent.click(screen.getByText('Disable Overage Notification'));

      renderGlobalModal();

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      await waitFor(() =>
        expect(updateMock).toHaveBeenCalledWith(
          `/customers/${softCapOrg.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              overageNotificationsDisabled: true,
            },
          })
        )
      );
    });

    it('enables overage notifications', async () => {
      ConfigStore.set('user', mockBillingAdminUser);
      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${noNotificationsOrg.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      setUpMocks(noNotificationsOrg, {
        hasOverageNotificationsDisabled: true,
        hasSoftCap: true,
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${noNotificationsOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: noNotificationsOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      renderGlobalModal();

      await userEvent.click(screen.getByText('Enable Overage Notification'));

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      await waitFor(() =>
        expect(updateMock).toHaveBeenCalledWith(
          `/customers/${noNotificationsOrg.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              overageNotificationsDisabled: false,
            },
          })
        )
      );
    });
  });

  describe('clear pending changes', () => {
    const pendingChangesOrg = OrganizationFixture();

    it('renders in the dropdown when there are pending changes', async () => {
      setUpMocks(pendingChangesOrg, {pendingChanges: true});

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${pendingChangesOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: pendingChangesOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(screen.getByText('Clear Pending Changes')).toBeInTheDocument();
    });

    it('is hidden when there are no changes', async () => {
      setUpMocks(organization);

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(screen.queryByText('Clear Pending Changes')).not.toBeInTheDocument();
    });
  });

  describe('allow trial', () => {
    const cannotTrialOrg = OrganizationFixture({slug: 'cannot-trial-org'});

    it('renders Allow Trial in the dropdown', async () => {
      setUpMocks(cannotTrialOrg, {canTrial: false, isTrial: false});

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${cannotTrialOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: cannotTrialOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(screen.getByRole('option', {name: /Allow Trial/})).toBeInTheDocument();
    });

    it('hides Allow Trial in the dropdown when not eligible', async () => {
      setUpMocks(organization, {canTrial: true, isTrial: false});

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(screen.queryByRole('option', {name: /Allow Trial/})).not.toBeInTheDocument();
    });

    it('hides Allow Trial in the dropdown when on active trial', async () => {
      setUpMocks(organization, {canTrial: false, isTrial: true});

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(screen.queryByRole('option', {name: /Allow Trial/})).not.toBeInTheDocument();
    });

    it('allows an org to trial', async () => {
      const trialMock = MockApiClient.addMockResponse({
        url: `/customers/${cannotTrialOrg.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      setUpMocks(cannotTrialOrg, {canTrial: false, isTrial: false});

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${cannotTrialOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: cannotTrialOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      renderGlobalModal();

      await userEvent.click(screen.getByRole('option', {name: /Allow Trial/}));

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      await waitFor(() => {
        expect(trialMock).toHaveBeenCalledWith(
          `/customers/${cannotTrialOrg.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              canTrial: true,
            },
          })
        );
      });
    });
  });

  describe('terminate contract', () => {
    const terminateOrg = OrganizationFixture();

    it('renders dropdown disabled without billing.admin permissions', async () => {
      ConfigStore.set('user', mockUser);

      setUpMocks(terminateOrg, {
        contractInterval: 'annual',
        canCancel: true,
        isBillingAdmin: false,
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${terminateOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: terminateOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(screen.getByTestId('terminateContract')).toHaveAttribute(
        'aria-disabled',
        'true'
      );

      await userEvent.hover(
        within(screen.getByTestId('terminateContract')).getByText('Terminate Contract')
      );

      expect(
        await screen.findByText('Requires billing admin permissions.')
      ).toBeInTheDocument();
    });

    it('renders dropdown enabled with billing.admin permissions', async () => {
      const mockBillingAdminUser = UserFixture({
        permissions: new Set(['billing.admin']),
      });

      ConfigStore.set('user', mockBillingAdminUser);

      setUpMocks(terminateOrg, {
        contractInterval: 'annual',
        canCancel: true,
        isBillingAdmin: false,
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${terminateOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: terminateOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(screen.getByTestId('terminateContract')).toBeEnabled();
    });

    it("terminates an organization's contract", async () => {
      const mockBillingAdminUser = UserFixture({
        permissions: new Set(['billing.admin']),
      });

      ConfigStore.set('user', mockBillingAdminUser);

      setUpMocks(terminateOrg, {
        contractInterval: 'annual',
        canCancel: true,
        isBillingAdmin: false,
      });

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${terminateOrg.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${terminateOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: terminateOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      await userEvent.click(screen.getByText('Terminate Contract'));

      renderGlobalModal();
      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      await waitFor(() => {
        expect(updateMock).toHaveBeenCalledWith(
          `/customers/${terminateOrg.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              terminateContract: true,
            },
          })
        );
      });
    });
  });

  describe('close account', () => {
    it('closes an account', async () => {
      setUpMocks(organization);

      const apiMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      renderGlobalModal();

      await userEvent.click(screen.getByText('Close Account'));

      expect(
        screen.getByText(
          'Are you sure you wish to continue? Once the process begins it is NOT REVERSIBLE.'
        )
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Close Account'}));

      await waitFor(() =>
        expect(apiMock).toHaveBeenCalledWith(
          `/customers/${organization.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              orgClose: true,
            },
          })
        )
      );
    });
  });

  describe('test vercel api endpoints', () => {
    it('calls api with extra data for refund', async () => {
      organization.features.push('vc-marketplace-active-customer');
      const subscription = SubscriptionFixture({
        organization,
        isSelfServePartner: true,
        partner: {
          externalId: '123',
          name: 'test',
          partnership: {
            id: 'XX',
            displayName: 'XX',
            supportNote: '',
          },
          isActive: true,
        },
      });
      setUpMocks(organization, subscription);

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      renderGlobalModal();

      await userEvent.click(screen.getByText('Vercel Refund'));

      expect(
        screen.getByText(
          'Send request to Vercel to initiate a refund for a given invoice.'
        )
      ).toBeInTheDocument();

      await userEvent.type(screen.getByRole('textbox', {name: 'Invoice GUID'}), '123');
      await userEvent.type(screen.getByRole('textbox', {name: 'Reason'}), 'test');

      const apiMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/refund-vercel/`,
        method: 'POST',
        body: {},
      });

      await userEvent.click(screen.getByRole('button', {name: 'Send Request'}));

      await waitFor(() =>
        expect(apiMock).toHaveBeenCalledWith(
          `/customers/${organization.slug}/refund-vercel/`,
          expect.objectContaining({
            method: 'POST',
            data: {
              guid: '123',
              reason: 'test',
            },
          })
        )
      );
    });

    it('does not render if subscription is not self serve partner', async () => {
      organization.features.push('vc-marketplace-active-customer');
      const subscription = SubscriptionFixture({
        organization,
        isSelfServePartner: false,
        partner: {
          externalId: '123',
          name: 'test',
          partnership: {
            id: 'XX',
            displayName: 'XX',
            supportNote: '',
          },
          isActive: true,
        },
      });
      setUpMocks(organization, subscription);

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      renderGlobalModal();

      expect(screen.queryByText('Vercel Refund')).not.toBeInTheDocument();
    });

    it('does not render without vc-marketplace-active-customer feature', async () => {
      organization.features = [];
      const subscription = SubscriptionFixture({
        organization,
        isSelfServePartner: true,
        partner: {
          externalId: '123',
          name: 'test',
          partnership: {
            id: 'XX',
            displayName: 'XX',
            supportNote: '',
          },
          isActive: true,
        },
      });
      setUpMocks(organization, subscription);

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      renderGlobalModal();

      expect(screen.queryByText('Vercel Refund')).not.toBeInTheDocument();
    });
  });

  describe('fork customer', () => {
    beforeEach(() => {
      ConfigStore.set('regions', [
        {
          name: 'foo',
          url: 'https://foo.example.com/api/0/',
        },
        {
          name: 'bar',
          url: 'https://bar.example.com/api/0/',
        },
      ]);
    });

    it('forks a customer', async () => {
      setUpMocks(organization);

      MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });
      const forkingMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/fork/`,
        method: 'POST',
        body: {
          dateAdded: '2023-12-18T01:02:03:45.678Z',
          dateUpdated: '2023-12-18T02:02:03:45.678Z',
          uuid: 'd39f84fc-554a-4d7d-95b7-78f983bcba73',
          creator: {
            email: 'alice@example.com',
            id: '2',
            username: 'alice',
          },
          owner: {
            email: 'alice@example.com',
            id: '2',
            username: 'alice',
          },
          status: 'IN_PROGRESS',
          step: 'IMPORTING',
          provenanve: 'SAAS_TO_SAAS',
          failureReason: 'A failure reason',
          scheduledPauseAtStep: null,
          scheduledCancelAtStep: null,
          provenance: 'SELF_HOSTED',
          wantOrgSlugs: ['foo'],
          wantUsernames: ['alice', 'david'],
        },
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      renderGlobalModal();

      await userEvent.click(screen.getByText('Fork Customer'));
      await selectEvent.openMenu(
        screen.getByRole('textbox', {name: 'Duplicate into Region'})
      );
      ['foo', 'bar'].forEach(step => expect(screen.getByText(step)).toBeInTheDocument());
      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Duplicate into Region'}),
        'bar'
      );

      await userEvent.click(
        screen.getByRole('button', {name: 'Fork Customer into Another Region'})
      );

      await waitFor(() =>
        expect(forkingMock).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/fork/`,
          expect.objectContaining({
            method: 'POST',
          })
        )
      );
    });
  });

  describe('cancel subscription', () => {
    const cancelSubOrg = OrganizationFixture();

    it('renders in the dropdown', async () => {
      setUpMocks(cancelSubOrg);

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${cancelSubOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: cancelSubOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
    });

    it('cancels a subscription', async () => {
      setUpMocks(cancelSubOrg);
      const apiMock = MockApiClient.addMockResponse({
        url: `/customers/${cancelSubOrg.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${cancelSubOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: cancelSubOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      await userEvent.click(screen.getByText('Cancel Subscription'));

      renderGlobalModal();

      expect(screen.getByText('End the subscription immediately.')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Cancel Subscription'}));

      await waitFor(() => {
        expect(apiMock).toHaveBeenCalledWith(
          `/customers/${cancelSubOrg.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              cancel: true,
              cancelAtPeriodEnd: true,
              applyBalance: true,
            },
          })
        );
      });
    });
  });

  describe('change plan', () => {
    const sub = SubscriptionFixture({
      organization,
      plan: 'mm2_b_500k',
    });

    it('is enabled for NT customers', async () => {
      const Subscription = SubscriptionFixture({
        organization,
        plan: 'am2_business',
        partner: {
          externalId: '123',
          name: 'test',
          partnership: {
            id: 'NT',
            displayName: 'NT',
            supportNote: '',
          },
          isActive: true,
        },
        sponsoredType: 'NT',
      });

      setUpMocks(organization, Subscription);
      MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/`,
        method: 'PUT',
        body: Subscription,
      });
      MockApiClient.addMockResponse({
        url: `/subscriptions/${sub.slug}/`,
        body: sub,
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      renderGlobalModal();

      await screen.findByRole('heading', {name: 'Customers'});
      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );
      expect(screen.getByTestId('changePlan')).toBeEnabled();
    });

    it('is enabled for deactivated partner account', async () => {
      const partnerSubscription = SubscriptionFixture({
        organization,
        plan: 'am2_business',
        partner: {
          externalId: '123',
          name: 'test',
          partnership: {
            id: 'XX',
            displayName: 'XX',
            supportNote: '',
          },
          isActive: false,
        },
        sponsoredType: 'XX',
      });

      setUpMocks(organization, partnerSubscription);
      MockApiClient.addMockResponse({
        url: `/customers/${partnerSubscription.slug}/`,
        method: 'PUT',
        body: partnerSubscription,
      });

      MockApiClient.addMockResponse({
        url: `/subscriptions/${sub.slug}/`,
        body: sub,
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      renderGlobalModal();

      await screen.findByRole('heading', {name: 'Customers'});
      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );
      expect(screen.getByTestId('changePlan')).toBeEnabled();
    });

    it('is disabled for active, non-XX partner account', async () => {
      const partnerSubscription = SubscriptionFixture({
        organization,
        plan: 'am2_business',
        partner: {
          externalId: '123',
          name: 'test',
          partnership: {
            id: 'XX',
            displayName: 'XX',
            supportNote: '',
          },
          isActive: true,
        },
        sponsoredType: 'XX',
      });

      setUpMocks(organization, partnerSubscription);

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});
      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(screen.getByTestId('changePlan')).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('early end', () => {
    it('can end trial early', async () => {
      const trialOrg = OrganizationFixture();

      setUpMocks(trialOrg, {isTrial: true});

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${trialOrg.slug}/`,
        method: 'PUT',
        body: trialOrg,
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${trialOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: trialOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      renderGlobalModal();

      await userEvent.click(screen.getByText('End Trial Early'));

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      await waitFor(() => {
        expect(updateMock).toHaveBeenCalledWith(
          `/customers/${trialOrg.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              endTrialEarly: true,
            },
          })
        );
      });
    });

    it('is disabled for non-trial org', async () => {
      setUpMocks(organization);

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(screen.getByTestId('endTrialEarly')).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });
  });

  describe('on demand invoices', () => {
    const invoicedOrg = OrganizationFixture({slug: 'invoiced'});
    const onDemandInvoicedOrg = OrganizationFixture({slug: 'ondemand-invoiced'});

    const mockBillingAdminUser = UserFixture({
      permissions: new Set(['billing.admin']),
    });

    ConfigStore.set('user', mockBillingAdminUser);

    it('renders disable on demand invoices when enabled', async () => {
      ConfigStore.set('user', mockBillingAdminUser);

      setUpMocks(invoicedOrg, {onDemandInvoiced: true});
      setUpMocks(onDemandInvoicedOrg, {
        onDemandInvoiced: true,
        type: BillingType.INVOICED,
        paymentSource: {
          last4: '4242',
          zipCode: '12345',
          countryCode: 'US',
          expMonth: 12,
          expYear: 2028,
          brand: 'Visa',
        },
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${onDemandInvoicedOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: onDemandInvoicedOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(screen.getByText('Disable On Demand Billing')).toBeInTheDocument();
    });

    it('renders enable on demand invoices when disabled', async () => {
      ConfigStore.set('user', mockBillingAdminUser);

      setUpMocks(invoicedOrg, {onDemandInvoiced: false});
      setUpMocks(onDemandInvoicedOrg, {
        onDemandInvoiced: false,
        type: BillingType.INVOICED,
        paymentSource: {
          last4: '4242',
          zipCode: '12345',
          countryCode: 'US',
          expMonth: 12,
          expYear: 2028,
          brand: 'Visa',
        },
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${onDemandInvoicedOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: onDemandInvoicedOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(screen.getByText('Enable On Demand Billing')).toBeInTheDocument();
    });

    it('does not render on-demand invoices actions when manually invoiced on-demand flag is True', async () => {
      ConfigStore.set('user', mockBillingAdminUser);

      setUpMocks(onDemandInvoicedOrg, {
        onDemandInvoiced: false,
        onDemandInvoicedManual: true,
        type: BillingType.INVOICED,
        paymentSource: {
          last4: '4242',
          zipCode: '12345',
          countryCode: 'US',
          expMonth: 12,
          expYear: 2028,
          brand: 'Visa',
        },
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${onDemandInvoicedOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: onDemandInvoicedOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(screen.queryByText('Enable On Demand Billing')).not.toBeInTheDocument();
    });

    it('enables on demand invoices when disabled', async () => {
      ConfigStore.set('user', mockBillingAdminUser);

      setUpMocks(invoicedOrg, {
        onDemandInvoiced: false,
        type: BillingType.INVOICED,
        paymentSource: {
          last4: '4242',
          zipCode: '12345',
          countryCode: 'US',
          expMonth: 12,
          expYear: 2028,
          brand: 'Visa',
        },
      });

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${invoicedOrg.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${invoicedOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: invoicedOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      renderGlobalModal();

      await userEvent.click(screen.getByText('Enable On Demand Billing'));

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      await waitFor(() =>
        expect(updateMock).toHaveBeenCalledWith(
          `/customers/${invoicedOrg.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              onDemandInvoiced: true,
            },
          })
        )
      );
    });

    it('disables on demand invoices when enabled', async () => {
      ConfigStore.set('user', mockBillingAdminUser);

      setUpMocks(onDemandInvoicedOrg, {
        onDemandInvoiced: true,
        type: BillingType.INVOICED,
        paymentSource: {
          last4: '4242',
          zipCode: '12345',
          countryCode: 'US',
          expMonth: 12,
          expYear: 2028,
          brand: 'Visa',
        },
      });

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${onDemandInvoicedOrg.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${onDemandInvoicedOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: onDemandInvoicedOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      renderGlobalModal();

      await userEvent.click(screen.getByText('Disable On Demand Billing'));

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      await waitFor(() =>
        expect(updateMock).toHaveBeenCalledWith(
          `/customers/${onDemandInvoicedOrg.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              onDemandInvoiced: false,
            },
          })
        )
      );
    });
  });

  describe('converting to sponsored', () => {
    it('converts a plan to sponsored', async () => {
      setUpMocks(organization);

      const apiMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      await userEvent.click(screen.getByText('Convert to Sponsored'));

      renderGlobalModal();

      const selectSponsoredType = await screen.findByRole('textbox', {
        name: 'Sponsored Type',
      });
      // Click for dropdown
      await userEvent.click(selectSponsoredType);
      await userEvent.click(screen.getByTestId('open_source'));

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      await waitFor(() =>
        expect(apiMock).toHaveBeenCalledWith(
          `/customers/${organization.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              sponsoredType: 'open_source',
            },
          })
        )
      );
    });

    it('can convert subscription with active partner account to sponsored', async () => {
      const partnerSubscription = SubscriptionFixture({
        organization,
        plan: 'am2_business',
        partner: {
          externalId: '123',
          name: 'test',
          partnership: {
            id: 'XX',
            displayName: 'XX',
            supportNote: '',
          },
          isActive: true,
        },
        sponsoredType: 'XX',
      });
      setUpMocks(organization, partnerSubscription);

      const apiMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      await userEvent.click(screen.getByText('Convert to Sponsored'));

      renderGlobalModal();

      const selectSponsoredType = await screen.findByRole('textbox', {
        name: 'Sponsored Type',
      });
      // Click for dropdown
      await userEvent.click(selectSponsoredType);
      await userEvent.click(screen.getByTestId('open_source'));

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      await waitFor(() =>
        expect(apiMock).toHaveBeenCalledWith(
          `/customers/${organization.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              sponsoredType: 'open_source',
            },
          })
        )
      );
    });

    it('cannot convert partner-type subscription to sponsored', async () => {
      const partnerSubscription = SubscriptionFixture({
        organization,
        isPartner: true,
      });
      setUpMocks(organization, partnerSubscription);

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(screen.getByTestId('convertToSponsored')).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });
  });

  describe('AddGiftEventsAction', () => {
    it('renders and hides modal', async () => {
      setUpMocks(organization);

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      const {waitForModalToHide} = renderGlobalModal();

      for (const dataCategory of [DataCategory.ERRORS, DataCategory.TRANSACTIONS]) {
        await userEvent.click(
          screen.getAllByRole('button', {
            name: 'Customers Actions',
          })[0]!
        );

        await userEvent.click(screen.getByTestId(`gift-${dataCategory}`));

        expect(
          await screen.findByText(
            `How many ${dataCategory} in multiples of 1,000s? (50 is 50,000 ${dataCategory})`
          )
        ).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
        await waitForModalToHide();
      }
    });

    it('can gift events - ERRORS', async () => {
      setUpMocks(organization);

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      renderGlobalModal();

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      const freeEventsKey = getFreeEventsKey(DataCategory.ERRORS);
      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/`,
        method: 'PUT',
        body: {...organization, [freeEventsKey]: 26000},
      });

      await userEvent.click(screen.getByTestId(`gift-${DataCategory.ERRORS}`));

      expect(screen.getByText('Total: 0')).toBeInTheDocument();

      // enter a number of events to gift
      const input = await screen.findByRole('textbox', {
        name: `How many ${DataCategory.ERRORS} in multiples of 1,000s? (50 is 50,000 ${DataCategory.ERRORS})`,
      });

      await userEvent.type(input, '26{enter}');

      expect(screen.getByText('Total: 26,000')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      await waitFor(() =>
        expect(updateMock).toHaveBeenCalledWith(
          `/customers/${organization.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              [freeEventsKey]: 26000,
            },
          })
        )
      );
    });

    it('can gift events - TRANSACTIONS', async () => {
      setUpMocks(organization);

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      renderGlobalModal();

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      const freeEventsKey = getFreeEventsKey(DataCategory.TRANSACTIONS);
      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/`,
        method: 'PUT',
        body: {...organization, [freeEventsKey]: 26000},
      });

      await userEvent.click(screen.getByTestId(`gift-${DataCategory.TRANSACTIONS}`));

      expect(screen.getByText('Total: 0')).toBeInTheDocument();

      // enter a number of events to gift
      const input = await screen.findByRole('textbox', {
        name: 'How many transactions in multiples of 1,000s? (50 is 50,000 transactions)',
      });

      await userEvent.type(input, '26{enter}');

      expect(screen.getByText('Total: 26,000')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      await waitFor(() =>
        expect(updateMock).toHaveBeenCalledWith(
          `/customers/${organization.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              [freeEventsKey]: 26000,
            },
          })
        )
      );
    });
  });

  it('can gift events - REPLAYS', async () => {
    const am2Sub = SubscriptionFixture({organization, plan: 'am2_f'});
    setUpMocks(organization, am2Sub);

    render(<CustomerDetails />, {
      initialRouterConfig: {
        location: {pathname: `/customers/${organization.slug}`},
        route: `/customers/:orgId`,
      },
      organization,
    });

    await screen.findByRole('heading', {name: 'Customers'});

    renderGlobalModal();

    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Customers Actions',
      })[0]!
    );

    const freeEventsKey = getFreeEventsKey(DataCategory.REPLAYS);
    const updateMock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'PUT',
      body: {...organization, [freeEventsKey]: 50},
    });

    await userEvent.click(screen.getByTestId(`gift-${DataCategory.REPLAYS}`));

    expect(screen.getByText('Total: 0')).toBeInTheDocument();

    // enter a number of events to gift
    const input = await screen.findByRole('textbox', {
      name: 'How many replays? (50 is 50 replays)',
    });

    await userEvent.type(input, '50{enter}');

    expect(screen.getByText('Total: 50')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith(
        `/customers/${organization.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: {
            [freeEventsKey]: 50,
          },
        })
      )
    );
  });

  it('can gift events - SPANS', async () => {
    const am3Sub = SubscriptionFixture({organization, plan: 'am3_f'});
    setUpMocks(organization, am3Sub);

    render(<CustomerDetails />, {
      initialRouterConfig: {
        location: {pathname: `/customers/${organization.slug}`},
        route: `/customers/:orgId`,
      },
      organization,
    });

    await screen.findByRole('heading', {name: 'Customers'});

    renderGlobalModal();

    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Customers Actions',
      })[0]!
    );

    const freeEventsKey = getFreeEventsKey(DataCategory.SPANS);
    const updateMock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'PUT',
      body: {...organization, [freeEventsKey]: 50},
    });

    await userEvent.click(screen.getByTestId(`gift-${DataCategory.SPANS}`));

    expect(screen.getByText('Total: 0')).toBeInTheDocument();

    // enter a number of events to gift
    const input = await screen.findByRole('textbox', {
      name: 'How many spans in multiples of 100,000s? (50 is 5,000,000 spans)',
    });

    await userEvent.type(input, '50{enter}');

    expect(screen.getByText('Total: 5,000,000')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith(
        `/customers/${organization.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: {
            [freeEventsKey]: 5_000_000,
          },
        })
      )
    );
  });
  it('cannot gift events in different units - SPANS_INDEXED', async () => {
    const am3Sub = Am3DsEnterpriseSubscriptionFixture({organization});
    setUpMocks(organization, am3Sub);

    render(<CustomerDetails />, {
      initialRouterConfig: {
        location: {pathname: `/customers/${organization.slug}`},
        route: `/customers/:orgId`,
      },
      organization,
    });

    await screen.findByRole('heading', {name: 'Customers'});

    renderGlobalModal();
    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Customers Actions',
      })[0]!
    );

    const item = screen.getByTestId(`gift-${DataCategory.SPANS_INDEXED}`);
    expect(item).toBeInTheDocument();
    expect(item).toHaveAttribute('aria-disabled', 'true');
  });
  it('cannot gift events without checkout category - SPANS_INDEXED', async () => {
    const am3Sub = SubscriptionFixture({organization, plan: 'am3_team'});
    setUpMocks(organization, am3Sub);

    render(<CustomerDetails />, {
      initialRouterConfig: {
        location: {pathname: `/customers/${organization.slug}`},
        route: `/customers/:orgId`,
      },
      organization,
    });

    await screen.findByRole('heading', {name: 'Customers'});

    renderGlobalModal();

    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Customers Actions',
      })[0]!
    );

    const item = screen.queryByTestId(`gift-${DataCategory.SPANS_INDEXED}`);
    expect(item).not.toBeInTheDocument();
  });

  it('can gift events - MONITOR SEATS', async () => {
    const am2Sub = SubscriptionFixture({organization, plan: 'am2_f'});
    setUpMocks(organization, am2Sub);

    render(<CustomerDetails />, {
      initialRouterConfig: {
        location: {pathname: `/customers/${organization.slug}`},
        route: `/customers/:orgId`,
      },
      organization,
    });

    await screen.findByRole('heading', {name: 'Customers'});

    renderGlobalModal();

    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Customers Actions',
      })[0]!
    );

    const freeEventsKey = getFreeEventsKey(DataCategory.MONITOR_SEATS);
    const updateMock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'PUT',
      body: {...organization, [freeEventsKey]: 50},
    });

    await userEvent.click(screen.getByTestId(`gift-${DataCategory.MONITOR_SEATS}`));

    expect(screen.getByText('Total: 0')).toBeInTheDocument();

    // enter a number of events to gift
    const input = await screen.findByRole('textbox', {
      name: 'How many cron monitors? (50 is 50 cron monitors)',
    });

    await userEvent.type(input, '50{enter}');

    expect(screen.getByText('Total: 50')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith(
        `/customers/${organization.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: {
            [freeEventsKey]: 50,
          },
        })
      )
    );
  });

  describe('adjust contract end dates', () => {
    const mockBillingAdminUser = UserFixture({
      permissions: new Set(['billing.admin']),
    });

    ConfigStore.set('user', mockBillingAdminUser);

    it('ChangeContractEndDateAction not rendered for monthly contract interval', async () => {
      const invoicedOrg = OrganizationFixture();

      setUpMocks(invoicedOrg, {contractInterval: 'monthly', type: BillingType.INVOICED});

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${invoicedOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: invoicedOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(
        screen.queryByRole('button', {name: 'Oct 24, 2018'})
      ).not.toBeInTheDocument();
    });

    it('ChangeContractEndDateAction rendered for annual contract interval', async () => {
      const invoicedOrg = OrganizationFixture();

      setUpMocks(invoicedOrg, {contractInterval: 'annual', type: BillingType.INVOICED});

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${invoicedOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: invoicedOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(screen.getByRole('button', {name: 'Oct 24, 2018'})).toBeInTheDocument();
    });
  });

  describe('unsuspend organization', () => {
    const suspendedOrg = OrganizationFixture({slug: 'suspended'});

    const mockBillingAdminUser = UserFixture({
      permissions: new Set(['billing.admin']),
    });

    ConfigStore.set('user', mockBillingAdminUser);

    it("doesn't render in the dropdown if already suspended", async () => {
      setUpMocks(suspendedOrg, {isSuspended: true});

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${suspendedOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: suspendedOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(screen.queryByText('Suspend Account')).not.toBeInTheDocument();
    });

    it('unsuspends an organization', async () => {
      setUpMocks(suspendedOrg, {isSuspended: true});

      const apiMock = MockApiClient.addMockResponse({
        url: `/customers/${suspendedOrg.slug}/`,
        method: 'PUT',
        body: suspendedOrg,
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${suspendedOrg.slug}`},
          route: `/customers/:orgId`,
        },
        organization: suspendedOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      renderGlobalModal();

      await userEvent.click(screen.getByText('Unsuspend Account'));

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      await waitFor(() =>
        expect(apiMock).toHaveBeenCalledWith(
          `/customers/${suspendedOrg.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              suspended: false,
            },
          })
        )
      );
    });

    it('suspends an organization', async () => {
      setUpMocks(organization, {isSuspended: false});

      const apiMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/`,
        method: 'PUT',
        body: organization,
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      renderGlobalModal();

      await userEvent.click(screen.getByText('Suspend Account'));

      expect(
        screen.getByText('This account was reported as fraudulent')
      ).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('radio', {
          name: 'Fraudulent',
        })
      );

      await userEvent.click(screen.getByRole('button', {name: 'Suspend Account'}));

      await waitFor(() => {
        // make sure onUpdate has been called with the correct arguments to update
        // the plan to be suspended, and that the mock response has been used
        expect(apiMock).toHaveBeenCalledWith(
          `/customers/${organization.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              suspended: true,
              suspensionReason: 'fraud',
            },
          })
        );
      });
    });
  });

  describe('AddGiftBudgetAction', () => {
    it('shows gift budget action when org has reserved budgets', async () => {
      const am3Sub = Am3DsEnterpriseSubscriptionFixture({
        organization,
      });
      setUpMocks(organization, am3Sub);

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {name: 'Customers Actions'})[0]!
      );

      expect(screen.getByText('Gift to reserved budget')).toBeInTheDocument();
    });

    it('hides gift budget action when org has no reserved budgets', async () => {
      const nonDsSub = SubscriptionFixture({
        organization,
      });
      setUpMocks(organization, nonDsSub);

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {name: 'Customers Actions'})[0]!
      );

      expect(screen.queryByText('Gift to reserved budget')).not.toBeInTheDocument();
    });

    it('can open modal and gift budget', async () => {
      const am3Sub = Am3DsEnterpriseSubscriptionFixture({
        organization,
      });
      setUpMocks(organization, am3Sub);

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/`,
        method: 'PUT',
        body: organization,
      });

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${organization.slug}`},
          route: `/customers/:orgId`,
        },
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});
      renderGlobalModal();

      // Open actions dropdown and click gift budget action
      await userEvent.click(
        screen.getAllByRole('button', {name: 'Customers Actions'})[0]!
      );
      await userEvent.click(screen.getByText('Gift to reserved budget'));

      // Fill out form
      await userEvent.type(
        screen.getByRole('spinbutton', {name: /gift amount \(\$\)/i}),
        '500'
      );
      await userEvent.type(
        screen.getByRole('textbox', {name: /ticketurl/i}),
        'https://example.com'
      );
      await userEvent.type(screen.getByRole('textbox', {name: /notes/i}), 'Test notes');

      // Submit form
      await userEvent.click(screen.getByRole('button', {name: /confirm/i}));
      await waitFor(() => {
        expect(updateMock).toHaveBeenCalledWith(
          `/customers/${organization.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: expect.objectContaining({
              freeReservedBudget: expect.any(Object),
              ticketUrl: 'https://example.com',
              notes: 'Test notes',
            }),
          })
        );
      });
    });
  });

  describe('delete billing metric history', () => {
    // Add afterEach to clean up after tests
    afterEach(() => {
      MockApiClient.clearMockResponses();
      jest.restoreAllMocks();
    });

    it('shows option when feature flag is enabled', async () => {
      // Set up organization with the required feature flag
      const orgWithDeleteFeature = OrganizationFixture({
        features: ['delete-billing-metric-history-admin'],
      });
      setUpMocks(orgWithDeleteFeature);

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${orgWithDeleteFeature.slug}`},
          route: `/customers/:orgId`,
        },
        organization: orgWithDeleteFeature,
      });

      await screen.findByRole('heading', {name: 'Customers'});
      renderGlobalModal();

      // Open the actions dropdown
      await userEvent.click(
        screen.getAllByRole('button', {name: 'Customers Actions'})[0]!
      );

      // The delete option should be present
      expect(screen.getByText('Delete Billing Metric History')).toBeInTheDocument();
    });

    it('does not show option when feature flag is missing', async () => {
      // Set up organization without the feature flag
      const orgWithoutDeleteFeature = OrganizationFixture({
        features: [],
      });
      setUpMocks(orgWithoutDeleteFeature);

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${orgWithoutDeleteFeature.slug}`},
          route: `/customers/:orgId`,
        },
        organization: orgWithoutDeleteFeature,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      // Open the actions dropdown
      await userEvent.click(
        screen.getAllByRole('button', {name: 'Customers Actions'})[0]!
      );

      // The delete option should not be present
      expect(screen.queryByText('Delete Billing Metric History')).not.toBeInTheDocument();
    });
  });

  describe('generate spike projections', () => {
    const org = OrganizationFixture({});

    it('renders generate spike projections in the dropdown', async () => {
      setUpMocks(org);

      render(<CustomerDetails />, {
        initialRouterConfig: {
          location: {pathname: `/customers/${org.slug}`},
          route: `/customers/:orgId`,
        },
        organization: org,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(
        screen.getByRole('option', {name: /Generate Spike Projections/})
      ).toBeInTheDocument();
    });
  });
});

describe('Gift Categories Availability', () => {
  const {organization} = initializeOrg();
  const customSubscription = SubscriptionFixture({
    organization,
    planDetails: {
      ...SubscriptionFixture({organization}).planDetails,
      checkoutCategories: [
        DataCategory.ERRORS,
        DataCategory.REPLAYS,
        DataCategory.SPANS,
        DataCategory.SEER_AUTOFIX,
        DataCategory.SEER_SCANNER,
      ],
      onDemandCategories: [
        DataCategory.ERRORS,
        DataCategory.PROFILE_DURATION,
        DataCategory.SEER_AUTOFIX,
        DataCategory.SEER_SCANNER,
      ],
      categories: [
        DataCategory.ERRORS,
        DataCategory.REPLAYS,
        DataCategory.PROFILE_DURATION,
        DataCategory.SPANS,
        DataCategory.SEER_AUTOFIX,
        DataCategory.SEER_SCANNER,
      ],
    },
    categories: {
      errors: MetricHistoryFixture({
        category: DataCategory.ERRORS,
        reserved: 50000,
        order: 1,
      }),
      replays: MetricHistoryFixture({
        category: DataCategory.REPLAYS,
        reserved: 50,
        order: 2,
      }),
      profileDuration: MetricHistoryFixture({
        category: DataCategory.PROFILE_DURATION,
        reserved: 0,
        order: 3,
      }),
      spans: MetricHistoryFixture({
        category: DataCategory.SPANS,
        reserved: -1, // Unlimited
        order: 4,
      }),
      seerAutofix: MetricHistoryFixture({
        category: DataCategory.SEER_AUTOFIX,
        reserved: 0,
        order: 5,
      }),
      seerScanner: MetricHistoryFixture({
        category: DataCategory.SEER_SCANNER,
        reserved: 0,
        order: 6,
      }),
    },
  });

  it('enables categories in checkoutCategories but not in onDemandCategories', async () => {
    setUpMocks(organization, customSubscription);

    render(<CustomerDetails />, {
      initialRouterConfig: {
        location: {pathname: `/customers/${organization.slug}`},
        route: `/customers/:orgId`,
      },
      organization,
    });

    await screen.findByRole('heading', {name: 'Customers'});

    renderGlobalModal();

    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Customers Actions',
      })[0]!
    );

    expect(screen.getByTestId(`gift-${DataCategory.REPLAYS}`)).not.toHaveAttribute(
      'aria-disabled'
    );
  });

  it('enables categories in onDemandCategories but not in checkoutCategories', async () => {
    setUpMocks(organization, customSubscription);

    render(<CustomerDetails />, {
      initialRouterConfig: {
        location: {pathname: `/customers/${organization.slug}`},
        route: `/customers/:orgId`,
      },
      organization,
    });

    await screen.findByRole('heading', {name: 'Customers'});

    renderGlobalModal();

    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Customers Actions',
      })[0]!
    );

    expect(
      screen.getByTestId(`gift-${DataCategory.PROFILE_DURATION}`)
    ).not.toHaveAttribute('aria-disabled');
  });

  it('enables categories in both checkoutCategories and onDemandCategories', async () => {
    setUpMocks(organization, customSubscription);

    render(<CustomerDetails />, {
      initialRouterConfig: {
        location: {pathname: `/customers/${organization.slug}`},
        route: `/customers/:orgId`,
      },
      organization,
    });

    await screen.findByRole('heading', {name: 'Customers'});

    renderGlobalModal();

    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Customers Actions',
      })[0]!
    );

    expect(screen.getByTestId(`gift-${DataCategory.ERRORS}`)).not.toHaveAttribute(
      'aria-disabled'
    );
  });

  it('disables categories with unlimited quota', async () => {
    setUpMocks(organization, customSubscription);

    render(<CustomerDetails />, {
      initialRouterConfig: {
        location: {pathname: `/customers/${organization.slug}`},
        route: `/customers/:orgId`,
      },
      organization,
    });

    await screen.findByRole('heading', {name: 'Customers'});

    renderGlobalModal();

    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Customers Actions',
      })[0]!
    );

    expect(screen.getByTestId(`gift-${DataCategory.SPANS}`)).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('filters out categories in neither checkoutCategories nor onDemandCategories', async () => {
    setUpMocks(organization, customSubscription);

    render(<CustomerDetails />, {
      initialRouterConfig: {
        location: {pathname: `/customers/${organization.slug}`},
        route: `/customers/:orgId`,
      },
      organization,
    });

    await screen.findByRole('heading', {name: 'Customers'});

    renderGlobalModal();

    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Customers Actions',
      })[0]!
    );

    expect(
      screen.queryByTestId(`gift-${DataCategory.PROFILE_DURATION_UI}`)
    ).not.toBeInTheDocument();
  });

  it('filters out categories that are not giftable', async () => {
    setUpMocks(organization, customSubscription);
    render(<CustomerDetails />, {
      initialRouterConfig: {
        location: {pathname: `/customers/${organization.slug}`},
        route: `/customers/:orgId`,
      },
      organization,
    });

    await screen.findByRole('heading', {name: 'Customers'});

    renderGlobalModal();

    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Customers Actions',
      })[0]!
    );

    expect(
      screen.queryByTestId(`gift-${DataCategory.SEER_AUTOFIX}`)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`gift-${DataCategory.SEER_SCANNER}`)
    ).not.toBeInTheDocument();
  });
});
