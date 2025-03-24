import {ThemeProvider} from '@emotion/react';
import {ConfigFixture} from 'sentry-fixture/config';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {BillingHistoryFixture} from 'getsentry-test/fixtures/billingHistory';
import {ChargeFixture} from 'getsentry-test/fixtures/charge';
import {InvoiceFixture} from 'getsentry-test/fixtures/invoice';
import {OnboardingTasksFixture} from 'getsentry-test/fixtures/onboardingTasks';
import {OwnerFixture} from 'getsentry-test/fixtures/owner';
import {PoliciesFixture} from 'getsentry-test/fixtures/policies';
import {ProjectFixture} from 'getsentry-test/fixtures/project';
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
import ModalStore from 'sentry/stores/modalStore';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import theme from 'sentry/utils/theme';
import * as useOrganization from 'sentry/utils/useOrganization';

import {FREE_EVENTS_KEYS} from 'admin/components/addGiftEventsAction';
import type {StatsGroup} from 'admin/components/customers/customerStats';
import {populateChartData, useSeries} from 'admin/components/customers/customerStats';
import CustomerDetails from 'admin/views/customerDetails';
import type {Subscription} from 'getsentry/types';
import {BillingType, PlanTier} from 'getsentry/types';

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

function renderMocks(
  organization: Organization,
  subscription?: Partial<MockSubscription>
) {
  // We mock the useOrganization hook here instead on the top level because we call renderMocks explicitly with different orgs
  // TODO(ogi): find a better way to do this
  jest.spyOn(useOrganization, 'default').mockReturnValue(organization as Organization);

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
}

describe('Customer Details', function () {
  const {organization, router} = initializeOrg();

  const mockUser = UserFixture({permissions: new Set([])});
  ConfigStore.loadInitialData(ConfigFixture({user: mockUser}));

  afterEach(() => {
    MockApiClient.clearMockResponses();
    ModalStore.reset();
  });

  it('populates chart data', function () {
    renderMocks(organization);

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
        color: theme.purple300,
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
        color: theme.purple200,
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
        color: theme.pink200,
      },
      {
        seriesName: 'Discarded (Client)',
        data: [],
        color: theme.yellow300,
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
        color: theme.red300,
      },
    ]);
  });

  it('renders correct sections', async function () {
    renderMocks(organization);

    render(<CustomerDetails />, {router, organization});

    await screen.findByRole('heading', {name: 'Customers'});
  });

  it('renders correct dropdown options', async function () {
    renderMocks(organization);

    render(<CustomerDetails />, {
      router,
      organization,
    });

    await screen.findByRole('heading', {name: 'Customers'});

    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Customers Actions',
      })[1]!
    );

    expect(screen.getByText('Start Trial')).toBeInTheDocument();
    expect(screen.getByText('Convert to Sponsored')).toBeInTheDocument();
    expect(screen.getByText('Gift errors')).toBeInTheDocument();
    expect(screen.getByText('Gift transactions')).toBeInTheDocument();
    expect(screen.getByText('Gift attachments')).toBeInTheDocument();
    expect(screen.getByText('Change Plan')).toBeInTheDocument();
    expect(screen.getByText('Start Enterprise Trial')).toBeInTheDocument();
    expect(screen.getByText('Change Google Domain')).toBeInTheDocument();
    expect(screen.getByText('Suspend Account')).toBeInTheDocument();
    expect(screen.getByText('Add Legacy Soft Cap')).toBeInTheDocument();
  });

  it('renders and hides generic confirmation modals', async function () {
    renderMocks(organization);
    render(<CustomerDetails />, {router, organization});

    await screen.findByRole('heading', {name: 'Customers'});

    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Customers Actions',
      })[1]!
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

  describe('change legacy soft cap', function () {
    const softCapOrg = OrganizationFixture({slug: 'soft-cap'});
    const {router: softCapRouter} = initializeOrg({organization: softCapOrg});
    const mockBillingAdminUser = UserFixture({
      permissions: new Set(['billing.admin']),
    });

    it('renders disabled without billing.admin permissions', async function () {
      ConfigStore.set('user', mockUser);

      renderMocks(organization, {isBillingAdmin: false});

      render(<CustomerDetails />, {router, organization});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {name: 'Customers Actions'})[1]!
      );

      expect(screen.getByTestId('action-changeSoftCap')).toHaveAttribute(
        'aria-disabled',
        'true'
      );

      await userEvent.hover(
        within(screen.getByTestId('action-changeSoftCap')).getByTestId('icon-not')
      );

      expect(
        await screen.findByText('Requires billing admin permissions.')
      ).toBeInTheDocument();
    });

    it('renders enabled with billing.admin permissions', async function () {
      ConfigStore.set('user', mockBillingAdminUser);
      renderMocks(softCapOrg, {isPartner: false});

      render(<CustomerDetails />, {router: softCapRouter, organization: softCapOrg});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      expect(screen.getByText('Add Legacy Soft Cap')).toBeInTheDocument();
    });

    it('renders disabled if legacy soft cap already enabled', async function () {
      ConfigStore.set('user', mockBillingAdminUser);
      renderMocks(softCapOrg, {isPartner: false, hasSoftCap: true});

      render(<CustomerDetails />, {router: softCapRouter, organization: softCapOrg});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[0]!
      );

      expect(screen.getByText('Remove Legacy Soft Cap')).toBeInTheDocument();
    });

    it('enables legacy soft cap', async function () {
      ConfigStore.set('user', mockBillingAdminUser);
      renderMocks(softCapOrg, {isPartner: false, hasSoftCap: false});

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${softCapOrg.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<CustomerDetails />, {router: softCapRouter, organization: softCapOrg});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
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

    it('disables legacy soft cap', async function () {
      ConfigStore.set('user', mockBillingAdminUser);
      renderMocks(softCapOrg, {isPartner: false, hasSoftCap: true});

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${softCapOrg.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<CustomerDetails />, {router: softCapRouter, organization: softCapOrg});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
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

  describe('change overage notifications', function () {
    const softCapOrg = OrganizationFixture({slug: 'soft-cap'});
    const {router: softCapRouter} = initializeOrg({organization: softCapOrg});
    const noNotificationsOrg = OrganizationFixture();
    const {router: noNotificationsRouter} = initializeOrg({
      organization: noNotificationsOrg,
    });

    const mockBillingAdminUser = UserFixture({
      permissions: new Set(['billing.admin']),
    });

    it('renders disable option with billing.admin permissions', async function () {
      ConfigStore.set('user', mockBillingAdminUser);
      renderMocks(softCapOrg, {hasOverageNotificationsDisabled: false, hasSoftCap: true});
      renderMocks(noNotificationsOrg, {
        hasOverageNotificationsDisabled: false,
        hasSoftCap: true,
      });

      render(<CustomerDetails />, {router: softCapRouter, organization: softCapOrg});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      expect(screen.getByText('Disable Overage Notification')).toBeInTheDocument();
    });

    it('renders enabled option with billing.admin permissions', async function () {
      ConfigStore.set('user', mockBillingAdminUser);
      renderMocks(softCapOrg, {hasOverageNotificationsDisabled: true, hasSoftCap: true});
      renderMocks(noNotificationsOrg, {
        hasOverageNotificationsDisabled: true,
        hasSoftCap: true,
      });

      render(<CustomerDetails />, {router: softCapRouter, organization: softCapOrg});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      expect(screen.getByText('Enable Overage Notification')).toBeInTheDocument();
    });

    it('disables overage notifications', async function () {
      ConfigStore.set('user', mockBillingAdminUser);
      renderMocks(softCapOrg, {hasOverageNotificationsDisabled: false, hasSoftCap: true});
      renderMocks(noNotificationsOrg, {
        hasOverageNotificationsDisabled: false,
        hasSoftCap: true,
      });

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${softCapOrg.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<CustomerDetails />, {router: softCapRouter, organization: softCapOrg});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
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

    it('enables overage notifications', async function () {
      ConfigStore.set('user', mockBillingAdminUser);
      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${noNotificationsOrg.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      renderMocks(noNotificationsOrg, {
        hasOverageNotificationsDisabled: true,
        hasSoftCap: true,
      });

      render(<CustomerDetails />, {
        router: noNotificationsRouter,
        organization: noNotificationsOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
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

  describe('clear pending changes', function () {
    const pendingChangesOrg = OrganizationFixture();
    const {router: pendingChangesRouter} = initializeOrg({
      organization: pendingChangesOrg,
    });

    it('renders in the dropdown when there are pending changes', async function () {
      renderMocks(pendingChangesOrg, {pendingChanges: true});

      render(<CustomerDetails />, {
        router: pendingChangesRouter,
        organization: pendingChangesOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      expect(screen.getByText('Clear Pending Changes')).toBeInTheDocument();
    });

    it('is hidden when there are no changes', async function () {
      renderMocks(organization);

      render(<CustomerDetails />, {router, organization});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      expect(screen.queryByText('Clear Pending Changes')).not.toBeInTheDocument();
    });
  });

  describe('allow trial', function () {
    const cannotTrialOrg = OrganizationFixture({slug: 'cannot-trial-org'});
    const {router: cannotTrialRouter} = initializeOrg({organization: cannotTrialOrg});

    it('renders Allow Trial in the dropdown', async function () {
      renderMocks(cannotTrialOrg, {canTrial: false, isTrial: false});

      render(<CustomerDetails />, {
        router: cannotTrialRouter,
        organization: cannotTrialOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      expect(screen.getByText('Allow Trial')).toBeInTheDocument();
    });

    it('hides Allow Trial in the dropdown when not eligible', async function () {
      renderMocks(organization, {canTrial: true, isTrial: false});

      render(<CustomerDetails />, {router, organization});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      expect(screen.queryByText('Allow Trial')).not.toBeInTheDocument();
    });

    it('hides Allow Trial in the dropdown when on active trial', async function () {
      renderMocks(organization, {canTrial: false, isTrial: true});

      render(<CustomerDetails />, {
        router,
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      expect(screen.queryByText('Allow Trial')).not.toBeInTheDocument();
    });

    it('allows an org to trial', async function () {
      const trialMock = MockApiClient.addMockResponse({
        url: `/customers/${cannotTrialOrg.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      renderMocks(cannotTrialOrg, {canTrial: false, isTrial: false});

      render(<CustomerDetails />, {
        router: cannotTrialRouter,
        organization: cannotTrialOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      renderGlobalModal();

      await userEvent.click(screen.getByText('Allow Trial'));

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

  describe('allow grace period', function () {
    const gracePeriodOrg = OrganizationFixture({slug: 'grace-period'});
    const {router: gracePeriodRouter} = initializeOrg({organization: gracePeriodOrg});

    it('renders in the dropdown', async function () {
      renderMocks(gracePeriodOrg);

      render(<CustomerDetails />, {
        router: gracePeriodRouter,
        organization: gracePeriodOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      expect(screen.getByText('Allow Grace Period')).toBeInTheDocument();
    });

    it('disabled in the dropdown', async function () {
      renderMocks(organization);

      render(<CustomerDetails />, {router, organization});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      expect(screen.getByTestId('action-allowGrace')).toHaveAttribute(
        'aria-disabled',
        'true'
      );

      await userEvent.hover(
        within(screen.getByTestId('action-allowGrace')).getByTestId('icon-not')
      );

      expect(
        await screen.findByText('Account may already be in a grace period')
      ).toBeInTheDocument();
    });

    it('allows an org to grace period again', async function () {
      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${gracePeriodOrg.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      renderMocks(gracePeriodOrg, {canGracePeriod: false});

      render(<CustomerDetails />, {
        router: gracePeriodRouter,
        organization: gracePeriodOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      renderGlobalModal();

      await userEvent.click(screen.getByText('Allow Grace Period'));

      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      await waitFor(() =>
        expect(updateMock).toHaveBeenCalledWith(
          `/customers/${gracePeriodOrg.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              canGracePeriod: true,
            },
          })
        )
      );
    });
  });

  describe('terminate contract', function () {
    const terminateOrg = OrganizationFixture();
    const {router: terminateRouter} = initializeOrg({organization: terminateOrg});

    it('renders dropdown disabled without billing.admin permissions', async function () {
      ConfigStore.set('user', mockUser);

      renderMocks(terminateOrg, {
        contractInterval: 'annual',
        canCancel: true,
        isBillingAdmin: false,
      });

      render(<CustomerDetails />, {
        router: terminateRouter,
        organization: terminateOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      expect(screen.getByTestId('action-terminateContract')).toHaveAttribute(
        'aria-disabled',
        'true'
      );

      await userEvent.hover(
        within(screen.getByTestId('action-terminateContract')).getByTestId('icon-not')
      );

      expect(
        await screen.findByText('Requires billing admin permissions.')
      ).toBeInTheDocument();
    });

    it('renders dropdown enabled with billing.admin permissions', async function () {
      const mockBillingAdminUser = UserFixture({
        permissions: new Set(['billing.admin']),
      });

      ConfigStore.set('user', mockBillingAdminUser);

      renderMocks(terminateOrg, {
        contractInterval: 'annual',
        canCancel: true,
        isBillingAdmin: false,
      });

      render(<CustomerDetails />, {router: terminateRouter, organization: terminateOrg});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      expect(screen.getByTestId('action-terminateContract')).toHaveAttribute(
        'aria-disabled',
        'false'
      );
    });

    it("terminates an organization's contract", async function () {
      const mockBillingAdminUser = UserFixture({
        permissions: new Set(['billing.admin']),
      });

      ConfigStore.set('user', mockBillingAdminUser);

      renderMocks(terminateOrg, {
        contractInterval: 'annual',
        canCancel: true,
        isBillingAdmin: false,
      });

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${terminateOrg.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<CustomerDetails />, {router: terminateRouter, organization: terminateOrg});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
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

  describe('close account', function () {
    it('closes an account', async function () {
      renderMocks(organization);

      const apiMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<CustomerDetails />, {router, organization});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
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

  describe('test vercel api endpoints', function () {
    it('calls api with correct args', async function () {
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
      renderMocks(organization, subscription);

      render(<CustomerDetails />, {router, organization});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      renderGlobalModal();

      await userEvent.click(screen.getByText('Test Vercel API'));

      expect(
        screen.getByText(
          'Test Vercel API endpoints for development and debugging purposes.'
        )
      ).toBeInTheDocument();

      await selectEvent.openMenu(screen.getByRole('textbox', {name: 'Vercel Endpoint'}));

      ['submit_billing_data', 'submit_invoice', 'create_event'].forEach(endpoint =>
        expect(screen.getByRole('menuitemradio', {name: endpoint})).toBeInTheDocument()
      );

      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Vercel Endpoint'}),
        'submit_billing_data'
      );

      const apiMock = MockApiClient.addMockResponse({
        url: `/_admin/test-vercel-api/`,
        method: 'POST',
        body: {},
      });

      await userEvent.click(screen.getByRole('button', {name: 'Send Request'}));

      await waitFor(() =>
        expect(apiMock).toHaveBeenCalledWith(
          `/_admin/test-vercel-api/`,
          expect.objectContaining({
            method: 'POST',
            data: {
              extra: null,
              organization_id: Number(subscription.id),
              vercel_endpoint: 'submit_billing_data',
            },
          })
        )
      );
    });

    it('calls api with extra data for submit invoice', async function () {
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
      renderMocks(organization, subscription);

      render(<CustomerDetails />, {router, organization});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      renderGlobalModal();

      await userEvent.click(screen.getByText('Test Vercel API'));

      expect(
        screen.getByText(
          'Test Vercel API endpoints for development and debugging purposes.'
        )
      ).toBeInTheDocument();

      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Vercel Endpoint'}),
        'submit_invoice'
      );

      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Invoice Result'}),
        'paid'
      );

      const apiMock = MockApiClient.addMockResponse({
        url: `/_admin/test-vercel-api/`,
        method: 'POST',
        body: {},
      });

      await userEvent.click(screen.getByRole('button', {name: 'Send Request'}));

      await waitFor(() =>
        expect(apiMock).toHaveBeenCalledWith(
          `/_admin/test-vercel-api/`,
          expect.objectContaining({
            method: 'POST',
            data: {
              extra: 'paid',
              organization_id: Number(subscription.id),
              vercel_endpoint: 'submit_invoice',
            },
          })
        )
      );
    });

    it('does not render if subscription is not self serve partner', async function () {
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
      renderMocks(organization, subscription);

      render(<CustomerDetails />, {router, organization});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      renderGlobalModal();

      expect(screen.queryByText('Test Vercel API')).not.toBeInTheDocument();
    });

    it('does not render without vc-marketplace-active-customer feature', async function () {
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
      renderMocks(organization, subscription);

      render(<CustomerDetails />, {router, organization});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      renderGlobalModal();

      expect(screen.queryByText('Test Vercel API')).not.toBeInTheDocument();
    });
  });

  describe('fork customer', function () {
    beforeEach(function () {
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

    it('forks a customer', async function () {
      renderMocks(organization);

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

      render(<CustomerDetails />, {router, organization});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
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

  describe('cancel subscription', function () {
    const cancelSubOrg = OrganizationFixture();
    const {router: cancelSubRouter} = initializeOrg({organization: cancelSubOrg});

    it('renders in the dropdown', async function () {
      renderMocks(cancelSubOrg);

      render(<CustomerDetails />, {
        router: cancelSubRouter,
        organization: cancelSubOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      expect(screen.getByText('Cancel Subscription')).toBeInTheDocument();
    });

    it('cancels a subscription', async function () {
      renderMocks(cancelSubOrg);
      const apiMock = MockApiClient.addMockResponse({
        url: `/customers/${cancelSubOrg.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<CustomerDetails />, {router: cancelSubRouter, organization: cancelSubOrg});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
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

  describe('change plan', function () {
    const sub = SubscriptionFixture({
      organization,
      plan: 'mm2_b_500k',
    });

    it('can change to an mm2 plan', async function () {
      renderMocks(organization, sub);

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${sub.slug}/`,
        method: 'PUT',
        body: sub,
      });

      render(<CustomerDetails />, {
        router,
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      renderGlobalModal();

      await userEvent.click(screen.getByText('Change Plan'));

      await userEvent.click(screen.getByTestId('mm2-tier'));

      await userEvent.click(screen.getByTestId('change-plan-radio-btn-mm2_b_500k'));

      await userEvent.click(screen.getByRole('button', {name: 'Change Plan'}));

      await waitFor(() => {
        expect(updateMock).toHaveBeenCalledWith(
          `/customers/${sub.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              plan: 'mm2_b_500k',
            },
          })
        );
      });
    });

    it('can change NT plan', async function () {
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

      renderMocks(organization, Subscription);
      MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/`,
        method: 'PUT',
        body: Subscription,
      });

      render(<CustomerDetails />, {
        router,
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});
      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      await userEvent.click(screen.getAllByText('Change Plan')[0]!);
      renderGlobalModal();
      expect(screen.queryByTestId('am2-tier')).not.toBeInTheDocument();
      expect(
        screen.getByTestId('change-plan-radio-btn-am2_business')
      ).toBeInTheDocument();
    });

    it('can change plan of deactivated partner account', async function () {
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

      renderMocks(organization, partnerSubscription);
      MockApiClient.addMockResponse({
        url: `/customers/${partnerSubscription.slug}/`,
        method: 'PUT',
        body: partnerSubscription,
      });

      render(<CustomerDetails />, {router, organization});

      await screen.findByRole('heading', {name: 'Customers'});
      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      await userEvent.click(screen.getAllByText('Change Plan')[0]!);
      renderGlobalModal();
      expect(screen.getByTestId('am3-tier')).toBeInTheDocument();
      expect(
        screen.getByTestId('change-plan-radio-btn-am3_business')
      ).toBeInTheDocument();
    });

    it('cannot change plan of active, non-XX partner account', async function () {
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

      renderMocks(organization, partnerSubscription);

      render(<CustomerDetails />, {
        router,
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});
      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      expect(screen.getByTestId('action-changePlan')).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });

    it('can change to an am1 plan', async function () {
      const am1Sub = SubscriptionFixture({organization, plan: 'am1_f'});
      renderMocks(organization, am1Sub);

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/`,
        method: 'PUT',
      });

      const subscriptionMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/subscription/`,
        method: 'PUT',
      });

      render(<CustomerDetails />, {
        router,
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});
      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      await userEvent.click(screen.getAllByText('Change Plan')[0]!);
      renderGlobalModal();

      await userEvent.click(screen.getByTestId('am1-tier'));

      await userEvent.click(screen.getByTestId('change-plan-radio-btn-am1_team'));

      const inputs = within(screen.getByRole('dialog')).getAllByRole('textbox');

      // reservedErrors
      await userEvent.click(inputs[0]!);
      await userEvent.click(screen.getByText('100,000'));

      // reservedTransactions
      await userEvent.click(inputs[1]!);
      await userEvent.click(screen.getByText('250,000'));

      // reservedReplays
      await userEvent.click(inputs[2]!);
      await userEvent.click(screen.getByText('25,000'));

      // reservedAttachments
      await userEvent.click(inputs[3]!);
      await userEvent.click(screen.getByText('25'));

      // reservedMonitorSeats
      await userEvent.click(inputs[4]!);
      await userEvent.click(
        screen.getAllByText('1').filter(e => e.id.includes('menuitem-label'))[0]!
      );

      // reservedUptime
      await userEvent.click(inputs[5]!);
      await userEvent.click(
        screen.getAllByText('1').filter(e => e.id.includes('menuitem-label'))[0]!
      );

      await userEvent.click(screen.getByRole('button', {name: 'Change Plan'}));

      await waitFor(() => {
        expect(subscriptionMock).toHaveBeenCalledWith(
          `/customers/${organization.slug}/subscription/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              plan: 'am1_team',
              reservedErrors: 100000,
              reservedTransactions: 250000,
              reservedReplays: 25_000,
              reservedAttachments: 25,
              reservedMonitorSeats: 1,
              reservedUptime: 1,
            },
          })
        );
      });

      expect(updateMock).not.toHaveBeenCalled();
    });

    it('requires am1 reserved volumes to be set', async function () {
      renderMocks(organization, sub);

      render(<CustomerDetails />, {router, organization});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      await userEvent.click(screen.getByText('Change Plan'));

      renderGlobalModal();

      await userEvent.click(screen.getByRole('link', {name: 'AM1'}));
      await userEvent.click(screen.getByTestId('change-plan-radio-btn-am1_team'));

      // Cannot submit yet.
      expect(screen.getByRole('button', {name: 'Change Plan'})).toBeDisabled();
    });

    it('can change to an am2 plan', async function () {
      renderMocks(organization, sub);

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/`,
        method: 'PUT',
      });
      const subscriptionMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/subscription/`,
        method: 'PUT',
      });

      render(<CustomerDetails />, {
        router,
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      await userEvent.click(screen.getByText('Change Plan'));

      renderGlobalModal();

      await userEvent.click(screen.getByTestId('am2-tier'));
      await userEvent.click(screen.getByTestId('change-plan-radio-btn-am2_team'));

      const inputs = within(screen.getByRole('dialog')).getAllByRole('textbox');

      // all plan options show up
      expect(screen.getByTestId('change-plan-radio-btn-am2_team')).toBeInTheDocument();
      expect(
        screen.getByTestId('change-plan-radio-btn-am2_business')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('change-plan-radio-btn-am2_team_bundle')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('change-plan-radio-btn-am2_business_249_bundle')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('change-plan-radio-btn-am2_business_bundle')
      ).toBeInTheDocument();

      // reservedErrors
      await userEvent.click(inputs[0]!);
      await userEvent.click(screen.getByText('100,000'));

      // reservedTransactions
      await userEvent.click(inputs[1]!);
      await userEvent.click(screen.getByText('250,000'));

      // reservedReplays
      await userEvent.click(inputs[2]!);
      await userEvent.click(screen.getByText('75,000'));

      // reservedAttachments
      await userEvent.click(inputs[3]!);
      await userEvent.click(screen.getByText('25'));

      // reservedMonitorSeats
      await userEvent.click(inputs[4]!);
      await userEvent.click(
        screen.getAllByText('1').filter(e => e.id.includes('menuitem-label'))[0]!
      );

      // reservedUptime
      await userEvent.click(inputs[6]!);
      await userEvent.click(
        screen.getAllByText('1').filter(e => e.id.includes('menuitem-label'))[0]!
      );

      await userEvent.click(screen.getByRole('button', {name: 'Change Plan'}));

      await waitFor(() =>
        expect(subscriptionMock).toHaveBeenCalledWith(
          `/customers/${organization.slug}/subscription/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              plan: 'am2_team',
              reservedErrors: 100000,
              reservedTransactions: 250000,
              reservedReplays: 75000,
              reservedAttachments: 25,
              reservedMonitorSeats: 1,
              reservedUptime: 1,
            },
          })
        )
      );

      expect(updateMock).not.toHaveBeenCalled();
    });

    it('can change to an am3 plan', async function () {
      renderMocks(organization, sub);

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/`,
        method: 'PUT',
      });
      const subscriptionMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/subscription/`,
        method: 'PUT',
      });

      render(<CustomerDetails />, {router, organization});
      renderGlobalModal();

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      await userEvent.click(screen.getByText('Change Plan'));

      await userEvent.click(screen.getByTestId('am3-tier'));
      await userEvent.click(screen.getByTestId('change-plan-radio-btn-am3_team'));

      // all plan options show up
      expect(screen.getByTestId('change-plan-radio-btn-am3_team')).toBeInTheDocument();
      expect(
        screen.getByTestId('change-plan-radio-btn-am3_business')
      ).toBeInTheDocument();

      // reservedErrors
      await selectEvent.openMenu(await screen.findByRole('textbox', {name: 'Errors'}));
      await userEvent.click(screen.getByText('100,000'));

      // reservedReplays
      await selectEvent.openMenu(await screen.findByRole('textbox', {name: 'Replays'}));
      await userEvent.click(screen.getByText('75,000'));

      // reservedSpans
      await selectEvent.openMenu(await screen.findByRole('textbox', {name: 'Spans'}));
      await userEvent.click(screen.getByRole('menuitemradio', {name: '20,000,000'}));

      // reservedProfileDuration
      await selectEvent.openMenu(
        await screen.findByRole('textbox', {name: 'Profile hours'})
      );
      await userEvent.click(screen.getByRole('menuitemradio', {name: '50'}));

      // reservedMonitorSeats
      await selectEvent.openMenu(
        await screen.findByRole('textbox', {name: 'Cron monitors'})
      );
      await userEvent.click(screen.getByRole('menuitemradio', {name: '1'}));

      // reservedUptime
      await selectEvent.openMenu(
        await screen.findByRole('textbox', {name: 'Uptime monitors'})
      );
      await userEvent.click(screen.getByRole('menuitemradio', {name: '1'}));

      // reservedAttachments
      await selectEvent.openMenu(
        await screen.findByRole('textbox', {name: 'Attachments (GB)'})
      );
      await userEvent.click(screen.getByRole('menuitemradio', {name: '25'}));

      await userEvent.click(screen.getByRole('button', {name: 'Change Plan'}));

      await waitFor(() =>
        expect(subscriptionMock).toHaveBeenCalledWith(
          `/customers/${organization.slug}/subscription/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              plan: 'am3_team',
              reservedErrors: 100_000,
              reservedReplays: 75_000,
              reservedSpans: 20_000_000,
              reservedMonitorSeats: 1,
              reservedAttachments: 25,
              reservedProfileDuration: 50,
              reservedUptime: 1,
            },
          })
        )
      );

      expect(updateMock).not.toHaveBeenCalled();
    });

    it('can change to an am3 plan with zero reserved', async function () {
      renderMocks(organization, sub);
      MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/billing-config/?tier=am3`,
        body: {
          ...BillingConfigFixture(PlanTier.AM3),
          defaultReserved: {
            errors: 50_000,
            attachments: 1,
            replays: 50,
            monitorSeats: 1,
            spans: 10_000_000,
            profileDuration: 0,
            uptime: 1,
          },
        },
      });

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/`,
        method: 'PUT',
      });
      const subscriptionMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/subscription/`,
        method: 'PUT',
      });

      render(<CustomerDetails />, {
        router,
        organization,
      });
      renderGlobalModal();

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      await userEvent.click(screen.getByText('Change Plan'));

      await userEvent.click(screen.getByTestId('am3-tier'));
      await userEvent.click(screen.getByTestId('change-plan-radio-btn-am3_team'));

      // all plan options show up
      expect(screen.getByTestId('change-plan-radio-btn-am3_team')).toBeInTheDocument();
      expect(
        screen.getByTestId('change-plan-radio-btn-am3_business')
      ).toBeInTheDocument();

      // reservedErrors
      await selectEvent.openMenu(await screen.findByRole('textbox', {name: 'Errors'}));
      await userEvent.click(screen.getByText('100,000'));

      // reservedReplays
      await selectEvent.openMenu(await screen.findByRole('textbox', {name: 'Replays'}));
      await userEvent.click(screen.getByText('75,000'));

      // reservedSpans
      await selectEvent.openMenu(await screen.findByRole('textbox', {name: 'Spans'}));
      await userEvent.click(screen.getByRole('menuitemradio', {name: '20,000,000'}));

      // reservedProfileDuration
      await selectEvent.openMenu(
        await screen.findByRole('textbox', {name: 'Profile hours'})
      );
      await userEvent.click(screen.getByRole('menuitemradio', {name: '0'}));

      // reservedMonitorSeats
      await selectEvent.openMenu(
        await screen.findByRole('textbox', {name: 'Cron monitors'})
      );
      await userEvent.click(screen.getByRole('menuitemradio', {name: '1'}));

      // reservedUptime
      await selectEvent.openMenu(
        await screen.findByRole('textbox', {name: 'Uptime monitors'})
      );
      await userEvent.click(screen.getByRole('menuitemradio', {name: '1'}));

      // reservedAttachments
      await selectEvent.openMenu(
        await screen.findByRole('textbox', {name: 'Attachments (GB)'})
      );
      await userEvent.click(screen.getByRole('menuitemradio', {name: '25'}));

      await userEvent.click(screen.getByRole('button', {name: 'Change Plan'}));

      await waitFor(() =>
        expect(subscriptionMock).toHaveBeenCalledWith(
          `/customers/${organization.slug}/subscription/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              plan: 'am3_team',
              reservedErrors: 100_000,
              reservedReplays: 75_000,
              reservedSpans: 20_000_000,
              reservedMonitorSeats: 1,
              reservedAttachments: 25,
              reservedProfileDuration: 0,
              reservedUptime: 1,
            },
          })
        )
      );

      expect(updateMock).not.toHaveBeenCalled();
    });
  });

  describe('early end', function () {
    it('can end trial early', async function () {
      const trialOrg = OrganizationFixture();
      const {router: trialRouter} = initializeOrg({organization: trialOrg});

      renderMocks(trialOrg, {isTrial: true});

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${trialOrg.slug}/`,
        method: 'PUT',
        body: trialOrg,
      });

      render(<CustomerDetails />, {router: trialRouter, organization: trialOrg});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
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

    it('is disabled for non-trial org', async function () {
      renderMocks(organization);

      render(<CustomerDetails />, {router, organization});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      expect(screen.getByTestId('action-endTrialEarly')).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });
  });

  describe('on demand invoices', function () {
    const invoicedOrg = OrganizationFixture({slug: 'invoiced'});
    const {router: invoicedRouter} = initializeOrg({organization: invoicedOrg});
    const onDemandInvoicedOrg = OrganizationFixture({slug: 'ondemand-invoiced'});
    const {router: onDemandInvoicedRouter} = initializeOrg({
      organization: onDemandInvoicedOrg,
    });

    const mockBillingAdminUser = UserFixture({
      permissions: new Set(['billing.admin']),
    });

    ConfigStore.set('user', mockBillingAdminUser);

    it('renders disable on demand invoices when enabled', async function () {
      ConfigStore.set('user', mockBillingAdminUser);

      renderMocks(invoicedOrg, {onDemandInvoiced: true});
      renderMocks(onDemandInvoicedOrg, {
        onDemandInvoiced: true,
        type: BillingType.INVOICED,
        paymentSource: {
          last4: '4242',
          zipCode: '12345',
          countryCode: 'US',
          expMonth: 12,
          expYear: 2028,
        },
      });

      render(<CustomerDetails />, {
        router: onDemandInvoicedRouter,
        organization: onDemandInvoicedOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      expect(screen.getByText('Disable On Demand Billing')).toBeInTheDocument();
    });

    it('renders enable on demand invoices when disabled', async function () {
      ConfigStore.set('user', mockBillingAdminUser);

      renderMocks(invoicedOrg, {onDemandInvoiced: false});
      renderMocks(onDemandInvoicedOrg, {
        onDemandInvoiced: false,
        type: BillingType.INVOICED,
        paymentSource: {
          last4: '4242',
          zipCode: '12345',
          countryCode: 'US',
          expMonth: 12,
          expYear: 2028,
        },
      });

      render(<CustomerDetails />, {
        router: onDemandInvoicedRouter,
        organization: onDemandInvoicedOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      expect(screen.getByText('Enable On Demand Billing')).toBeInTheDocument();
    });

    it('does not render on-demand invoices actions when manually invoiced on-demand flag is True', async function () {
      ConfigStore.set('user', mockBillingAdminUser);

      renderMocks(onDemandInvoicedOrg, {
        onDemandInvoiced: false,
        onDemandInvoicedManual: true,
        type: BillingType.INVOICED,
        paymentSource: {
          last4: '4242',
          zipCode: '12345',
          countryCode: 'US',
          expMonth: 12,
          expYear: 2028,
        },
      });

      render(<CustomerDetails />, {
        router: onDemandInvoicedRouter,
        organization: onDemandInvoicedOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      expect(screen.queryByText('Enable On Demand Billing')).not.toBeInTheDocument();
    });

    it('enables on demand invoices when disabled', async function () {
      ConfigStore.set('user', mockBillingAdminUser);

      renderMocks(invoicedOrg, {
        onDemandInvoiced: false,
        type: BillingType.INVOICED,
        paymentSource: {
          last4: '4242',
          zipCode: '12345',
          countryCode: 'US',
          expMonth: 12,
          expYear: 2028,
        },
      });

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${invoicedOrg.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<CustomerDetails />, {router: invoicedRouter, organization: invoicedOrg});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
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

    it('disables on demand invoices when enabled', async function () {
      ConfigStore.set('user', mockBillingAdminUser);

      renderMocks(onDemandInvoicedOrg, {
        onDemandInvoiced: true,
        type: BillingType.INVOICED,
        paymentSource: {
          last4: '4242',
          zipCode: '12345',
          countryCode: 'US',
          expMonth: 12,
          expYear: 2028,
        },
      });

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${onDemandInvoicedOrg.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<CustomerDetails />, {
        router: onDemandInvoicedRouter,
        organization: onDemandInvoicedOrg,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
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

  describe('converting to sponsored', function () {
    it('converts a plan to sponsored', async function () {
      renderMocks(organization);

      const apiMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<CustomerDetails />, {router, organization});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
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

    it('can convert subscription with active partner account to sponsored', async function () {
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
      renderMocks(organization, partnerSubscription);

      const apiMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/`,
        method: 'PUT',
        body: OrganizationFixture(),
      });

      render(<CustomerDetails />, {
        router,
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
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

    it('cannot convert partner-type subscription to sponsored', async function () {
      const partnerSubscription = SubscriptionFixture({
        organization,
        isPartner: true,
      });
      renderMocks(organization, partnerSubscription);

      render(<CustomerDetails />, {
        router,
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      expect(screen.getByTestId('action-convertToSponsored')).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });
  });

  describe('AddGiftEventsAction', function () {
    it('renders and hides modal', async function () {
      renderMocks(organization);

      render(<CustomerDetails />, {router, organization});

      await screen.findByRole('heading', {name: 'Customers'});

      const {waitForModalToHide} = renderGlobalModal();

      for (const dataCategory of [DataCategory.ERRORS, DataCategory.TRANSACTIONS]) {
        await userEvent.click(
          screen.getAllByRole('button', {
            name: 'Customers Actions',
          })[1]!
        );

        await userEvent.click(screen.getByTestId(`action-gift-${dataCategory}`));

        expect(
          await screen.findByText(
            `How many ${dataCategory} in multiples of 1,000s? (50 is 50,000 ${dataCategory})`
          )
        ).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
        await waitForModalToHide();
      }
    });

    it('can gift events - ERRORS', async function () {
      renderMocks(organization);

      render(<CustomerDetails />, {
        router,
        organization,
      });

      await screen.findByRole('heading', {name: 'Customers'});

      renderGlobalModal();

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      const freeEventsKey = FREE_EVENTS_KEYS[DataCategory.ERRORS];
      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/`,
        method: 'PUT',
        body: {...organization, [freeEventsKey]: 26000},
      });

      await userEvent.click(screen.getByTestId(`action-gift-${DataCategory.ERRORS}`));

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

    it('can gift events - TRANSACTIONS', async function () {
      renderMocks(organization);

      render(<CustomerDetails />, {router, organization});

      await screen.findByRole('heading', {name: 'Customers'});

      renderGlobalModal();

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      const freeEventsKey = FREE_EVENTS_KEYS[DataCategory.TRANSACTIONS];
      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/`,
        method: 'PUT',
        body: {...organization, [freeEventsKey]: 26000},
      });

      await userEvent.click(
        screen.getByTestId(`action-gift-${DataCategory.TRANSACTIONS}`)
      );

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

  it('can gift events - REPLAYS', async function () {
    const am2Sub = SubscriptionFixture({organization, plan: 'am2_f'});
    renderMocks(organization, am2Sub);

    render(<CustomerDetails />, {
      router,
      organization,
    });

    await screen.findByRole('heading', {name: 'Customers'});

    renderGlobalModal();

    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Customers Actions',
      })[1]!
    );

    const freeEventsKey = FREE_EVENTS_KEYS[DataCategory.REPLAYS];
    const updateMock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'PUT',
      body: {...organization, [freeEventsKey]: 50},
    });

    await userEvent.click(screen.getByTestId(`action-gift-${DataCategory.REPLAYS}`));

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

  it('can gift events - SPANS', async function () {
    const am3Sub = SubscriptionFixture({organization, plan: 'am3_f'});
    renderMocks(organization, am3Sub);

    render(<CustomerDetails />, {router, organization});

    await screen.findByRole('heading', {name: 'Customers'});

    renderGlobalModal();

    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Customers Actions',
      })[1]!
    );

    const freeEventsKey = FREE_EVENTS_KEYS[DataCategory.SPANS];
    const updateMock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'PUT',
      body: {...organization, [freeEventsKey]: 50},
    });

    await userEvent.click(screen.getByTestId(`action-gift-${DataCategory.SPANS}`));

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
  it('cannot gift events in different units - SPANS_INDEXED', async function () {
    const am3Sub = Am3DsEnterpriseSubscriptionFixture({organization});
    renderMocks(organization, am3Sub);

    render(<CustomerDetails />, {
      router,
      organization,
    });

    await screen.findByRole('heading', {name: 'Customers'});

    renderGlobalModal();
    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Customers Actions',
      })[1]!
    );

    const item = screen.getByTestId(`action-gift-${DataCategory.SPANS_INDEXED}`);
    expect(item).toBeInTheDocument();
    expect(item).toHaveAttribute('aria-disabled', 'true');
  });
  it('cannot gift events without checkout category - SPANS_INDEXED', async function () {
    const am3Sub = SubscriptionFixture({organization, plan: 'am3_team'});
    renderMocks(organization, am3Sub);

    render(<CustomerDetails />, {router, organization});

    await screen.findByRole('heading', {name: 'Customers'});

    renderGlobalModal();

    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Customers Actions',
      })[1]!
    );

    const item = screen.getByTestId(`action-gift-${DataCategory.SPANS_INDEXED}`);
    expect(item).toBeInTheDocument();
    expect(item).toHaveAttribute('aria-disabled', 'true');
  });

  it('can gift events - MONITOR SEATS', async function () {
    const am2Sub = SubscriptionFixture({organization, plan: 'am2_f'});
    renderMocks(organization, am2Sub);

    render(<CustomerDetails />, {
      router,
      organization,
    });

    await screen.findByRole('heading', {name: 'Customers'});

    renderGlobalModal();

    await userEvent.click(
      screen.getAllByRole('button', {
        name: 'Customers Actions',
      })[1]!
    );

    const freeEventsKey = FREE_EVENTS_KEYS[DataCategory.MONITOR_SEATS];
    const updateMock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      method: 'PUT',
      body: {...organization, [freeEventsKey]: 50},
    });

    await userEvent.click(
      screen.getByTestId(`action-gift-${DataCategory.MONITOR_SEATS}`)
    );

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

  describe('adjust contract end dates', function () {
    const mockBillingAdminUser = UserFixture({
      permissions: new Set(['billing.admin']),
    });

    ConfigStore.set('user', mockBillingAdminUser);

    it('ChangeContractEndDateAction not rendered for monthly contract interval', async function () {
      const invoicedOrg = OrganizationFixture();
      const {router: invoicedRouter} = initializeOrg({organization: invoicedOrg});

      renderMocks(invoicedOrg, {contractInterval: 'monthly', type: BillingType.INVOICED});

      render(<CustomerDetails />, {router: invoicedRouter, organization: invoicedOrg});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      expect(
        screen.queryByRole('button', {name: 'Oct 24, 2018'})
      ).not.toBeInTheDocument();
    });

    it('ChangeContractEndDateAction rendered for annual contract interval', async function () {
      const invoicedOrg = OrganizationFixture();
      const {router: invoicedRouter} = initializeOrg({organization: invoicedOrg});

      renderMocks(invoicedOrg, {contractInterval: 'annual', type: BillingType.INVOICED});

      render(<CustomerDetails />, {router: invoicedRouter, organization: invoicedOrg});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      expect(screen.getByRole('button', {name: 'Oct 24, 2018'})).toBeInTheDocument();
    });
  });

  describe('unsuspend organization', function () {
    const suspendedOrg = OrganizationFixture({slug: 'suspended'});
    const {router: suspendedRouter} = initializeOrg({organization: suspendedOrg});

    const mockBillingAdminUser = UserFixture({
      permissions: new Set(['billing.admin']),
    });

    ConfigStore.set('user', mockBillingAdminUser);

    it("doesn't render in the dropdown if already suspended", async function () {
      renderMocks(suspendedOrg, {isSuspended: true});

      render(<CustomerDetails />, {router: suspendedRouter, organization: suspendedOrg});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
      );

      expect(screen.queryByText('Suspend Account')).not.toBeInTheDocument();
    });

    it('unsuspends an organization', async function () {
      renderMocks(suspendedOrg, {isSuspended: true});

      const apiMock = MockApiClient.addMockResponse({
        url: `/customers/${suspendedOrg.slug}/`,
        method: 'PUT',
        body: suspendedOrg,
      });

      render(<CustomerDetails />, {router: suspendedRouter, organization: suspendedOrg});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
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

    it('suspends an organization', async function () {
      renderMocks(organization, {isSuspended: false});

      const apiMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/`,
        method: 'PUT',
        body: organization,
      });

      render(<CustomerDetails />, {router, organization});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {
          name: 'Customers Actions',
        })[1]!
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

  describe('AddGiftBudgetAction', function () {
    it('shows gift budget action when org has reserved budgets', async function () {
      const am3Sub = Am3DsEnterpriseSubscriptionFixture({
        organization,
        hasReservedBudgets: true,
      });
      renderMocks(organization, am3Sub);

      render(<CustomerDetails />, {router, organization});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {name: /customers actions/i})[1]!
      );

      expect(screen.getByText('Gift to reserved budget')).toBeInTheDocument();
    });

    it('hides gift budget action when org has no reserved budgets', async function () {
      const nonDsSub = SubscriptionFixture({
        organization,
        hasReservedBudgets: false,
      });
      renderMocks(organization, nonDsSub);

      render(<CustomerDetails />, {router, organization});

      await screen.findByRole('heading', {name: 'Customers'});

      await userEvent.click(
        screen.getAllByRole('button', {name: /customers actions/i})[1]!
      );

      expect(screen.queryByText('Gift to reserved budget')).not.toBeInTheDocument();
    });

    it('can open modal and gift budget', async function () {
      const am3Sub = Am3DsEnterpriseSubscriptionFixture({
        organization,
        hasReservedBudgets: true,
      });
      renderMocks(organization, am3Sub);

      const updateMock = MockApiClient.addMockResponse({
        url: `/customers/${organization.slug}/`,
        method: 'PUT',
        body: organization,
      });

      render(<CustomerDetails />, {router, organization});

      await screen.findByRole('heading', {name: 'Customers'});
      renderGlobalModal();

      // Open actions dropdown and click gift budget action
      await userEvent.click(
        screen.getAllByRole('button', {name: /customers actions/i})[1]!
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
});
